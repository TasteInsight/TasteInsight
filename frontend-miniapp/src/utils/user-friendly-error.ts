import { t } from '@/i18n';
export function toUserFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message || '';

    // Standardized HTTP error thrown by request.ts: `HTTP <code>`
    const httpMatch = message.match(/^HTTP\s+(\d{3})$/);
    if (httpMatch) {
      const code = Number(httpMatch[1]);
      if (code === 401) return t('common.errors.expired');
      if (code === 404) return t('common.errors.missing');
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

const businessErrorKeys: Record<string, string> = {
  INVALID_VERIFICATION_CODE: 'invalidCode',
  VERIFICATION_RATE_LIMITED: 'verificationRateLimit',
  VERIFICATION_METHOD_DISABLED: 'verificationDisabled',
  LOGIN_METHOD_DISABLED: 'loginDisabled',
  IDENTITY_ALREADY_BOUND: 'identityBound',
  STUDENT_VERIFICATION_REQUIRED: 'studentRequired',
  DIETARY_CONFLICT: 'dietaryConflict',
  ACTIVE_DINING_INVITATION: 'activeInvitation',
  INVALID_CAMPUS_CONFIRMATION: 'invalidCampusConfirmation',
};

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
  const isBusinessError = [400, 403, 409, 410, 413, 422, 429].includes(statusCode);
  const translationKey =
    typeof payload.code === 'string' ? businessErrorKeys[payload.code] : undefined;
  const error = new Error(
    translationKey
      ? t(`common.errors.${translationKey}`)
      : isBusinessError && detail
        ? detail.slice(0, 300)
        : toUserFriendlyErrorMessage(new Error(`HTTP ${statusCode}`))
  ) as HttpRequestError;
  error.statusCode = statusCode;
  if (typeof payload.code === 'string') error.code = payload.code;
  return error;
}
