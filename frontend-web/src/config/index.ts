import { env } from './env'

/**
 * 应用配置
 */
export const config = {
  /** API 基础地址 */
  baseURL: env.VITE_API_BASE_URL,
  
  /** 请求超时时间 */
  timeout: 30000,
  
  /** 默认请求头 */
  headers: {
    'Content-Type': 'application/json'
  }
}

export default config
