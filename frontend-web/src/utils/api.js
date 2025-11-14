import axios from 'axios'

// 创建 axios 实例
// 注意：请根据实际后端服务地址配置 VITE_API_BASE_URL 环境变量
// 在项目根目录创建 .env 文件，添加：VITE_API_BASE_URL=https://your-api-domain.com
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加 token
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误
request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      
      // 401 未授权，清除 token 并跳转到登录页
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

// API工具函数
export const api = {
  // 管理员登录
  async adminLogin(credentials) {
    return request.post('/auth/admin/login', {
      username: credentials.username,
      password: credentials.password
    })
  },
  
  // 模拟API调用（保留原有接口）
  async getDishes() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: 1, name: '示例菜品', canteen: '紫荆园', status: 'active' }
        ])
      }, 500)
    })
  },
  
  async addDish(dishData) {
    console.log('添加菜品:', dishData)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, id: Date.now() })
      }, 500)
    })
  },
  
  async updateDish(id, dishData) {
    console.log('更新菜品:', id, dishData)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true })
      }, 500)
    })
  },
  
  async deleteDish(id) {
    console.log('删除菜品:', id)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true })
      }, 500)
    })
  },
  
  async uploadExcel(file) {
    console.log('上传Excel文件:', file.name)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ 
          success: true, 
          data: [
            { id: 1, name: '麻婆豆腐', canteen: '紫荆园', status: '有效' }
          ] 
        })
      }, 1000)
    })
  },
  
  // 人员管理相关接口
  // 获取子管理员列表
  async getAdmins(params = {}) {
    const { page = 1, pageSize = 10 } = params
    return request.get(`/admin/admins?page=${page}&pageSize=${pageSize}`)
  },
  
  // 创建子管理员
  async createAdmin(data) {
    return request.post('/admin/admins', {
      username: data.username,
      password: data.password,
      canteenId: data.canteenId,
      permissions: data.permissions || []
    })
  },
  
  // 删除子管理员
  async deleteAdmin(adminId) {
    return request.delete(`/admin/admins/${adminId}`)
  },
  
  // 更新子管理员权限
  async updateAdminPermissions(adminId, permissions) {
    return request.put(`/admin/admins/${adminId}/permissions`, {
      permissions: permissions || []
    })
  }
}

export default api