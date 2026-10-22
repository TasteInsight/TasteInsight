import { t } from '@/i18n';
export function toUserFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message || '';

    // Standardized HTTP error thrown by request.ts: `HTTP <code>`
    const httpMatch = message.match(/^HTTP\s+(\d{3})$/);
    if (httpMatch) {
      const code = Number(httpMatch[1]);
      if (code === 401) return t('common.errors.expired');
      if (code === 403) return t('common.errors.forbidden');
      if (code === 409) return t('common.errors.conflict');
      if (code === 410) return t('common.errors.gone');
      if (code === 413) return t('common.errors.tooLarge');
      if (code === 429) return t('common.errors.rateLimit');
      return t('common.errors.network');
    }

    if (message.includes(t('common.errors.disconnected'))) {
      return t('common.errors.network');
    }

    // Preserve business errors / validation messages
    if (message.trim()) return message;
  }

  return t('common.errors.network');
}

export type HttpRequestError = Error & { statusCode: number; code?: string };

export function createHttpError(statusCode: number, body?: unknown): HttpRequestError {
  const payload =
    body && typeof body === 'object' ? (body as { code?: unknown; message?: unknown }) : {};
  const messages = Array.isArray(payload.message)
    ? payload.message.filter(item => typeof item === 'string')
    : [payload.message];
  const detail = messages
    .filter(item => typeof item === 'string')
    .join('；')
    .trim();
  const isBusinessError = [400, 403, 404, 409, 410, 413, 422, 429].includes(statusCode);
  const error = new Error(
    isBusinessError && detail
      ? detail.slice(0, 300)
      : toUserFriendlyErrorMessage(new Error(`HTTP ${statusCode}`))
  ) as HttpRequestError;
  error.statusCode = statusCode;
  if (typeof payload.code === 'string') error.code = payload.code;
  return error;
}
