import { defineStore } from 'pinia'
import { api } from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('admin_token') || null,
    user: JSON.parse(localStorage.getItem('admin_user') || 'null'),
    isAuthenticated: !!localStorage.getItem('admin_token')
  }),
  
  getters: {
    isLoggedIn: (state) => !!state.token && state.isAuthenticated
  },
  
  actions: {
    async login(credentials) {
      // TODO: 暂时注释掉真实接口调用，允许任何信息直接登录
      // try {
      //   const response = await api.adminLogin(credentials)
      //   
      //   // 假设接口返回格式为 { token: '...', user: {...} }
      //   // 根据实际接口返回格式调整
      //   const { token, data } = response
      //   
      //   this.token = token || data?.token
      //   this.user = data?.user || data
      //   this.isAuthenticated = true
      //   
      //   // 保存到 localStorage
      //   if (credentials.remember) {
      //     localStorage.setItem('admin_token', this.token)
      //     localStorage.setItem('admin_user', JSON.stringify(this.user))
      //   } else {
      //     // 使用 sessionStorage 临时存储
      //     sessionStorage.setItem('admin_token', this.token)
      //     sessionStorage.setItem('admin_user', JSON.stringify(this.user))
      //   }
      //   
      //   return response
      // } catch (error) {
      //   this.logout()
      //   throw error
      // }
      
      // 临时模拟登录：直接设置 token 和用户信息
      this.token = 'mock_token_' + Date.now()
      this.user = {
        username: credentials.username || '管理员',
        name: credentials.username || '管理员',
        id: Date.now()
      }
      this.isAuthenticated = true
      
      // 保存到 localStorage
      if (credentials.remember) {
        localStorage.setItem('admin_token', this.token)
        localStorage.setItem('admin_user', JSON.stringify(this.user))
      } else {
        // 使用 sessionStorage 临时存储
        sessionStorage.setItem('admin_token', this.token)
        sessionStorage.setItem('admin_user', JSON.stringify(this.user))
      }
      
      return {
        token: this.token,
        data: {
          user: this.user
        }
      }
    },
    
    logout() {
      this.token = null
      this.user = null
      this.isAuthenticated = false
      
      // 清除存储
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      sessionStorage.removeItem('admin_token')
      sessionStorage.removeItem('admin_user')
    },
    
    // 初始化时从存储中恢复状态
    initAuth() {
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token')
      const user = localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user')
      
      if (token) {
        this.token = token
        this.isAuthenticated = true
      }
      
      if (user) {
        try {
          this.user = JSON.parse(user)
        } catch (e) {
          console.error('Failed to parse user data:', e)
        }
      }
    }
  }
})

