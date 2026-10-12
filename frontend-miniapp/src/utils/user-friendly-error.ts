export function toUserFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message || '';

    // Standardized HTTP error thrown by request.ts: `HTTP <code>`
    const httpMatch = message.match(/^HTTP\s+(\d{3})$/);
    if (httpMatch) {
      const code = Number(httpMatch[1]);
      if (code === 401) return '登录已过期，请重新登录';
      if (code === 403) return '没有权限执行此操作';
      if (code === 409) return '内容已更新，请刷新后重试';
      if (code === 410) return '内容已过期，请刷新后重试';
      if (code === 413) return '上传内容过大，请压缩图片后重试';
      if (code === 429) return '操作太频繁，请稍后再试';
      return '网络开小差了，请稍后再试';
    }

    if (message.includes('网络连接异常')) {
      return '网络开小差了，请稍后再试';
    }

    // Preserve business errors / validation messages
    if (message.trim()) return message;
  }

  return '网络开小差了，请稍后再试';
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
