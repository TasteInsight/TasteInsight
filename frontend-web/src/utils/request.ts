import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import config from '@/config'

/**
 * Mock 模式开关（通过 localStorage 控制，设置 'mock_mode=true' 启用）
 */
const isMockMode = () => {
  return localStorage.getItem('mock_mode') === 'true' || !config.baseURL || config.baseURL.includes('localhost:0')
}

/**
 * Mock 数据生成器
 */
const mockResponse = {
  // Mock 图片上传
  '/upload/image': (data: any) => {
    const file = data instanceof FormData ? data.get('file') : null
    if (!file) {
      return Promise.reject(new Error('请选择图片文件'))
    }
    
    // 模拟上传延迟
    return new Promise((resolve) => {
      setTimeout(() => {
        // 生成模拟的图片 URL（使用 base64 或占位符）
        const mockUrl = file instanceof File 
          ? URL.createObjectURL(file) 
          : 'https://via.placeholder.com/800x800?text=Mock+Image'
        
        resolve({
          code: 200,
          message: '上传成功',
          data: {
            url: mockUrl,
            filename: file instanceof File ? file.name : 'mock-image.jpg'
          }
        })
      }, 500)
    })
  },
  
  // Mock 创建菜品
  '/admin/dishes': (data: any) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockDish = {
          id: `DISH_${Date.now()}`,
          name: data.name,
          price: data.price,
          description: data.description || '',
          images: data.images || [],
          tags: data.tags || [],
          ingredients: data.ingredients || [],
          allergens: data.allergens || [],
          canteenId: data.canteenId || '',
          canteenName: data.canteenName,
          floor: data.floor || '',
          windowNumber: data.windowNumber || '',
          windowName: data.windowName,
          availableMealTime: data.availableMealTime || [],
          status: data.status || 'offline',
          averageRating: 0,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        resolve({
          code: 201,
          message: '创建成功',
          data: mockDish
        })
      }, 800)
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
 * 响应拦截器 - 处理错误和 Mock
 */
service.interceptors.response.use(
  (response: AxiosResponse) => {
    // 返回 response.data，这样调用方直接获得数据
    return response.data as any
  },
  async (error) => {
    // 如果是网络错误且启用了 Mock 模式，尝试使用 Mock 数据
    if (isMockMode() && error.request && !error.response) {
      const config = error.config as any
      const url = config?.url || ''
      const method = config?.method?.toLowerCase() || 'get'
      
      if (method === 'post' && mockResponse[url as keyof typeof mockResponse]) {
        const mockHandler = mockResponse[url as keyof typeof mockResponse]
        try {
          const mockData = await mockHandler(config.data)
          console.log('[Mock]', url, mockData)
          return mockData as any
        } catch (mockError) {
          return Promise.reject(mockError)
        }
      }
    }
    
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

// 封装请求方法，确保返回正确的类型，并支持 Mock
const request = {
  get<T = any>(url: string, config?: any): Promise<T> {
    return service.get(url, config)
  },
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    // Mock 模式处理
    if (isMockMode() && mockResponse[url as keyof typeof mockResponse]) {
      const mockHandler = mockResponse[url as keyof typeof mockResponse]
      try {
        const mockData = await mockHandler(data)
        console.log('[Mock]', url, mockData)
        return mockData as T
      } catch (error) {
        return Promise.reject(error)
      }
    }
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
