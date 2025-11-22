import { env } from './env'

/**
 * 获取有效的 API 基础地址
 */
const getBaseURL = () => {
  // 使用环境变量配置的地址
  return env.VITE_API_BASE_URL || ''
}

/**
 * 应用配置
 */
export const config = {
  /** API 基础地址 */
  baseURL: getBaseURL(),

  /** 请求超时时间 */
  timeout: 30000,

  /** 默认请求头 */
  headers: {
    'Content-Type': 'application/json'
  }
}

export default config
