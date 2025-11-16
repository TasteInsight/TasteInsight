/**
 * 环境变量配置
 */

/**
 * 获取环境变量值
 */
export const env = {
  /** API 基础地址 */
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  
  /** 开发环境 */
  DEV: import.meta.env.DEV,
  
  /** 生产环境 */
  PROD: import.meta.env.PROD,
  
  /** 模式 */
  MODE: import.meta.env.MODE
}

export default env
