import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import config from '@/config'

// 懒加载 auth store 避免循环依赖
let authStore: any = null
const getAuthStore = () => {
  if (!authStore) {
    // 动态导入避免循环依赖
    import('@/store/modules/use-auth-store').then(module => {
      authStore = module.useAuthStore()
    })
  }
  return authStore
}

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
    // 添加认证 token
    // 优先从 auth store 获取 token，如果 store 未初始化则从 storage 获取
    const store = getAuthStore()
    const token = store?.token || localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token')

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 是否正在刷新 token
let isRefreshing = false
// 待重试的请求队列
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = []

// 处理队列中的请求
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve(token)
    }
  })
  failedQueue = []
}

/**
 * 响应拦截器 - 处理错误和认证
 */
service.interceptors.response.use(
  (response: AxiosResponse) => {
    // 返回 response.data，这样调用方直接获得数据
    return response.data as any
  },
  async (error) => {
    const originalRequest = error.config
    
    if (error.response) {
      const { status, data } = error.response
      
      // 401 未授权 - 尝试刷新 token
      // 排除登录接口，登录接口的 401 是账号密码错误，不需要刷新 token
      // 使用正则匹配 /auth/admin/login 或 /auth/wechat/login
      const isLoginRequest = /\/auth\/(admin|wechat)\/login$/.test(originalRequest.url || '');
      
      if (status === 401 && !originalRequest._retry && !isLoginRequest) {
        if (isRefreshing) {
          // 如果正在刷新 token，将请求放入队列
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token
            return service(originalRequest)
          }).catch(err => {
            return Promise.reject(err)
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        const store = getAuthStore()
        const refreshToken = store?.refreshToken || localStorage.getItem('admin_refresh_token') || sessionStorage.getItem('admin_refresh_token')
        
        if (!refreshToken) {
          // 没有 refresh token，直接登出
          if (store) {
            store.logout()
          } else {
            localStorage.removeItem('admin_token')
            localStorage.removeItem('admin_refresh_token')
            sessionStorage.removeItem('admin_token')
            sessionStorage.removeItem('admin_refresh_token')
          }
          processQueue(new Error('认证已过期，请重新登录'), null)
          isRefreshing = false
          return Promise.reject(new Error('认证已过期，请重新登录'))
        }

        try {
          // 尝试刷新 token
          const response = await service.post('/auth/refresh', { refreshToken })
          const newToken = response.data?.token?.accessToken
          
          if (newToken) {
            // 更新 token
            if (store) {
              store.token = newToken
              if (localStorage.getItem('admin_token')) {
                localStorage.setItem('admin_token', newToken)
              } else {
                sessionStorage.setItem('admin_token', newToken)
              }
            }
            
            // 处理队列中的请求
            processQueue(null, newToken)
            
            // 重试原始请求
            originalRequest.headers['Authorization'] = 'Bearer ' + newToken
            return service(originalRequest)
          } else {
            throw new Error('刷新 token 失败')
          }
        } catch (refreshError) {
          // 刷新失败，清除认证信息
          if (store) {
            store.logout()
          } else {
            localStorage.removeItem('admin_token')
            localStorage.removeItem('admin_refresh_token')
            sessionStorage.removeItem('admin_token')
            sessionStorage.removeItem('admin_refresh_token')
          }
          processQueue(refreshError, null)
          return Promise.reject(new Error('认证已过期，请重新登录'))
        } finally {
          isRefreshing = false
        }
      }
      
      // 403 无权限
      if (status === 403) {
        return Promise.reject(new Error('无权限访问该资源'))
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
  async get<T = any>(url: string, config?: any): Promise<T> {
    return service.get(url, config)
  },
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return service.post(url, data, config)
  },
  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
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