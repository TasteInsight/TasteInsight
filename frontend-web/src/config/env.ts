export function normalizeApiBaseUrl(value: string | undefined): string {
  const normalized = value?.trim().replace(/\/+$/, '')
  if (!normalized) {
    throw new Error('VITE_API_BASE_URL must be configured for the current mode')
  }

  return normalized
}

export const env = {
  /** API 基础地址 */
  VITE_API_BASE_URL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),

  /** 开发环境 */
  DEV: import.meta.env.DEV,

  /** 生产环境 */
  PROD: import.meta.env.PROD,

  /** 模式 */
  MODE: import.meta.env.MODE,
}

export default env
