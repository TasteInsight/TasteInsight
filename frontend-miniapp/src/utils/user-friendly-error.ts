export function toUserFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message || '';

    // Standardized HTTP error thrown by request.ts: `HTTP <code>`
    const httpMatch = message.match(/^HTTP\s+(\d{3})$/);
    if (httpMatch) {
      const code = Number(httpMatch[1]);
      if (code === 401) return '登录已过期，请重新登录';
      if (code >= 500) return '服务器开小差了，请稍后再试';
      // 400/403/404/429/...
      return '网络开小差了，请稍后再试';
    }

    if (message.includes('网络连接异常')) {
      return '网络开小差了，请检查网络后重试';
    }

    // Preserve business errors / validation messages
    if (message.trim()) return message;
  }

  return '网络开小差了，请稍后再试';
}
