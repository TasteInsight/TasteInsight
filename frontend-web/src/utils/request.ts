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
 * Mock 模式开关（通过 localStorage 控制，设置 'mock_mode=true' 启用）
 * 
 * 如何启用/关闭 Mock 模式：
 * 1. 在浏览器控制台执行：localStorage.setItem('mock_mode', 'true') 启用
 * 2. 在浏览器控制台执行：localStorage.removeItem('mock_mode') 关闭
 * 3. 或者设置环境变量 VITE_API_BASE_URL 为空或无效值会自动启用
 */
const isMockMode = () => {
  return localStorage.getItem('mock_mode') === 'true' || !config.baseURL || config.baseURL.includes('localhost:0')
  // return false;
}

/**
 * Mock 数据生成器 - 仅保留登录功能
 */
const mockResponse = {
  // Mock 管理员登录
  '/auth/admin/login': (data: any) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 模拟验证用户名和密码
        if (data.username && data.password) {
          const mockResponse = {
            code: 200,
            message: '登录成功',
            data: {
              token: {
                accessToken: `mock_access_token_${Date.now()}`,
                refreshToken: `mock_refresh_token_${Date.now()}`
              },
              admin: {
                id: 'admin_001',
                username: data.username,
                role: 'admin',
                permissions: ['dish:read', 'dish:write', 'dish:review', 'admin:read'],
                createdAt: new Date().toISOString()
              },
              permissions: ['dish:read', 'dish:write', 'dish:review', 'admin:read']
            }
          }
          console.log('[Mock] 管理员登录:', data.username)
          resolve(mockResponse)
        } else {
          reject({
            code: 400,
            message: '用户名或密码不能为空'
          })
        }
      }, 500)
    })
  }
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
 * 响应拦截器 - 处理错误和 Mock
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
      if (status === 401 && !originalRequest._retry) {
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

// 封装请求方法，确保返回正确的类型，并支持 Mock（仅登录）
const request = {
  async get<T = any>(url: string, config?: any): Promise<T> {
    return service.get(url, config)
  },
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    // Mock 模式处理 POST 请求（仅登录）
    if (isMockMode()) {
      // 只处理登录接口
      if (url === '/auth/admin/login' && mockResponse[url as keyof typeof mockResponse]) {
        const mockHandler = mockResponse[url as keyof typeof mockResponse]
        try {
          const mockData = await (mockHandler as any)(data)
          console.log('[Mock POST]', url, '登录成功')
          return mockData as T
        } catch (error) {
          return Promise.reject(error)
        }
      }
    }
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
