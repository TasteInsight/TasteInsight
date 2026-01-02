export function toUserFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message || '';

    // Standardized HTTP error thrown by request.ts: `HTTP <code>`
    const httpMatch = message.match(/^HTTP\s+(\d{3})$/);
    if (httpMatch) {
      const code = Number(httpMatch[1]);
      if (code === 401) return '登录已过期，请重新登录';
      // 其它 HTTP 错误：用户侧统一展示友好文案
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
