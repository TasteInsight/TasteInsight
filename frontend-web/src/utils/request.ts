import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import config from '@/config'

/**
 * 创建 axios 实例
 */
const service: AxiosInstance = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: config.headers
})

/**
 * 请求拦截器 - 添加 token
 */
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * 响应拦截器 - 处理错误
 */
service.interceptors.response.use(
  (response: AxiosResponse) => {
    // 返回 response.data，这样调用方直接获得数据
    return response.data as any
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      
      // 401 未授权，清除 token
      if (status === 401) {
        localStorage.removeItem('admin_token')
        sessionStorage.removeItem('admin_token')
        // 这里不直接跳转，由调用方处理
      }
      
      // 返回错误信息
      const message = data?.message || data?.error || '请求失败，请稍后重试'
      return Promise.reject(new Error(message))
    } else if (error.request) {
      return Promise.reject(new Error('网络连接失败，请检查网络'))
    } else {
      return Promise.reject(error)
    }
  }
)

// 封装请求方法，确保返回正确的类型
const request = {
  get<T = any>(url: string, config?: any): Promise<T> {
    return service.get(url, config)
  },
  post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return service.post(url, data, config)
  },
  put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return service.put(url, data, config)
  },
  delete<T = any>(url: string, config?: any): Promise<T> {
    return service.delete(url, config)
  },
  patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return service.patch(url, data, config)
  }
}

export default request
