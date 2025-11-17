import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import config from '@/config'

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
  '/admin/dishes': (data: any, url: string, method?: string) => {
    // 如果是 PUT 请求（更新菜品），处理更新逻辑
    if (method === 'put' || url.includes('/admin/dishes/') && !url.includes('/status') && !url.includes('/batch')) {
      const idMatch = url.match(/\/admin\/dishes\/([^/]+)/)
      const dishId = idMatch ? idMatch[1] : `DISH_${Date.now()}`
      
      return new Promise((resolve) => {
        setTimeout(() => {
          const mockDish = {
            id: dishId,
            name: data.name || '更新后的菜品',
            price: data.price || 0,
            description: data.description || '',
            images: data.images || [],
            tags: data.tags || [],
            ingredients: data.ingredients || [],
            allergens: data.allergens || [],
            canteenId: data.canteenId || '',
            canteenName: data.canteenName || '',
            floor: data.floor || '',
            windowNumber: data.windowNumber || '',
            windowName: data.windowName || '',
            availableMealTime: data.availableMealTime || [],
            status: data.status || 'offline',
            averageRating: 0,
            reviewCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          
          resolve({
            code: 200,
            message: '更新成功',
            data: mockDish
          })
        }, 600)
      })
    }
    
    // POST 请求（创建菜品）
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
  },
  
  // ========== Mock 审核相关接口 ==========
  // 注意：以下 Mock 接口仅在 mock_mode=true 时生效
  // 要关闭 Mock，执行：localStorage.removeItem('mock_mode')
  
  // Mock 获取待审核菜品列表
  '/admin/dishes/uploads/pending': (params: any) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟待审核菜品数据
        const mockItems = [
          {
            id: '1',
            name: '水煮肉片',
            canteenName: '观畴园',
            floor: '二层',
            window: '自选菜',
            price: 15,
            images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
            ingredients: ['猪肉', '豆芽', '辣椒', '花椒'],
            allergens: [],
            uploaderId: 'user1',
            uploaderNickname: '张师傅',
            status: 'pending',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2小时前
          },
          {
            id: '2',
            name: '辛拉面',
            canteenName: '桃李园',
            floor: '一层',
            window: '韩国风味',
            price: 10,
            images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
            ingredients: ['拉面', '鸡蛋', '海苔'],
            allergens: ['鸡蛋'],
            uploaderId: 'user2',
            uploaderNickname: 'NoraexX',
            status: 'pending',
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5小时前
          },
          {
            id: '3',
            name: '宜宾燃面',
            canteenName: '清芬园',
            floor: '一层',
            window: '面食窗口',
            price: 12,
            images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
            ingredients: ['面条', '花生', '芽菜'],
            allergens: ['花生'],
            uploaderId: 'user3',
            uploaderNickname: '某不愿透露姓名的曾姓男子',
            status: 'pending',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1天前
          },
          {
            id: '4',
            name: '菠萝咕咾肉',
            canteenName: '观畴园',
            floor: '二层',
            window: '自选菜',
            price: 18,
            images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
            ingredients: ['猪肉', '菠萝', '青椒', '红椒'],
            allergens: [],
            uploaderId: 'user4',
            uploaderNickname: 'ljx666',
            status: 'pending',
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3小时前
          }
        ]
        
        resolve({
          code: 200,
          message: '获取成功',
          data: {
            items: mockItems,
            meta: {
              page: params?.page || 1,
              pageSize: params?.pageSize || 10,
              total: mockItems.length,
              totalPages: 1
            }
          }
        })
      }, 500)
    })
  },
  
  // Mock 批准审核（动态匹配 URL）
  '/admin/dishes/uploads/': (data: any, url: string) => {
    // 检查是否是 approve 或 reject 请求
    if (url.includes('/approve')) {
      const id = url.match(/\/uploads\/([^/]+)\/approve/)?.[1]
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('[Mock] 批准审核:', id)
          resolve({
            code: 200,
            message: '审核已通过',
            data: { success: true }
          })
        }, 300)
      })
    } else if (url.includes('/reject')) {
      const id = url.match(/\/uploads\/([^/]+)\/reject/)?.[1]
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('[Mock] 拒绝审核:', id, '原因:', data?.reason)
          resolve({
            code: 200,
            message: '审核已拒绝',
            data: { success: true }
          })
        }, 300)
      })
    }
    return Promise.reject(new Error('未知的审核操作'))
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
  async get<T = any>(url: string, config?: any): Promise<T> {
    // Mock 模式处理 GET 请求
    if (isMockMode()) {
      // 检查精确匹配
      if (mockResponse[url as keyof typeof mockResponse]) {
        const mockHandler = mockResponse[url as keyof typeof mockResponse]
        try {
          const params = config?.params || {}
          const mockData = await (mockHandler as any)(params, url)
          console.log('[Mock GET]', url, mockData)
          return mockData as T
        } catch (error) {
          return Promise.reject(error)
        }
      }
      
      // 检查获取单个菜品（GET /admin/dishes/{id}）
      if (url.match(/^\/admin\/dishes\/[^/]+$/) && !url.includes('/status') && !url.includes('/batch')) {
        const idMatch = url.match(/\/admin\/dishes\/([^/]+)/)
        const dishId = idMatch ? idMatch[1] : ''
        
        try {
          // 返回模拟的单个菜品数据
          const mockDish = {
            id: dishId,
            name: '模拟菜品',
            canteenName: '紫荆园',
            canteenId: 'canteen1',
            floor: '二层',
            windowName: '自选菜',
            windowNumber: '01',
            price: 15,
            description: '这是一个模拟的菜品数据，用于测试编辑功能',
            images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
            tags: ['川菜', '微辣'],
            ingredients: ['猪肉', '豆芽', '辣椒', '花椒'],
            allergens: [],
            availableMealTime: ['lunch', 'dinner'],
            status: 'offline',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString()
          }
          
          const mockData = {
            code: 200,
            message: '获取成功',
            data: mockDish
          }
          console.log('[Mock GET]', url, mockData)
          return mockData as T
        } catch (error) {
          return Promise.reject(error)
        }
      }
      
      // 检查获取菜品列表（通过列表接口模拟）
      if (url === '/admin/dishes' && config?.params?.keyword) {
        const mockHandler = mockResponse['/admin/dishes' as keyof typeof mockResponse]
        if (mockHandler) {
          try {
            // 返回模拟的菜品列表，包含匹配的菜品
            const mockData = {
              code: 200,
              message: '获取成功',
              data: {
                items: [
                  {
                    id: config.params.keyword,
                    name: '模拟菜品',
                    canteenName: '紫荆园',
                    floor: '二层',
                    windowName: '自选菜',
                    windowNumber: '01',
                    price: 15,
                    description: '这是一个模拟的菜品数据',
                    images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
                    tags: ['川菜', '微辣'],
                    ingredients: ['猪肉', '豆芽'],
                    allergens: [],
                    availableMealTime: ['lunch', 'dinner'],
                    status: 'offline',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  }
                ],
                meta: {
                  page: 1,
                  pageSize: 10,
                  total: 1,
                  totalPages: 1
                }
              }
            }
            console.log('[Mock GET]', url, mockData)
            return mockData as T
          } catch (error) {
            return Promise.reject(error)
          }
        }
      }
    }
    return service.get(url, config)
  },
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    // Mock 模式处理 POST 请求
    if (isMockMode()) {
      // 先检查精确匹配
      if (mockResponse[url as keyof typeof mockResponse]) {
        const mockHandler = mockResponse[url as keyof typeof mockResponse]
        try {
          const mockData = await (mockHandler as any)(data, url, 'post')
          console.log('[Mock POST]', url, mockData)
          return mockData as T
        } catch (error) {
          return Promise.reject(error)
        }
      }
      // 检查动态匹配（用于审核接口）
      if (url.includes('/admin/dishes/uploads/')) {
        const mockHandler = mockResponse['/admin/dishes/uploads/' as keyof typeof mockResponse]
        if (mockHandler) {
          try {
            const mockData = await (mockHandler as any)(data, url)
            console.log('[Mock POST]', url, mockData)
            return mockData as T
          } catch (error) {
            return Promise.reject(error)
          }
        }
      }
    }
    return service.post(url, data, config)
  },
  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    // Mock 模式处理 PUT 请求（更新菜品）
    if (isMockMode() && url.includes('/admin/dishes/') && !url.includes('/status')) {
      const mockHandler = mockResponse['/admin/dishes' as keyof typeof mockResponse]
      if (mockHandler) {
        try {
          const mockData = await (mockHandler as any)(data, url, 'put')
          console.log('[Mock PUT]', url, mockData)
          return mockData as T
        } catch (error) {
          return Promise.reject(error)
        }
      }
    }
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
