import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') || null)
  const user = ref(JSON.parse(localStorage.getItem('admin_user') || 'null'))
  const isAuthenticated = ref(!!localStorage.getItem('admin_token'))

  const isLoggedIn = computed(() => !!token.value && isAuthenticated.value)

  const login = async (credentials: any) => {
    // TODO: 暂时注释掉真实接口调用，允许任何信息直接登录
    // try {
    //   const response = await api.adminLogin(credentials)
    //   
    //   // 假设接口返回格式为 { token: '...', user: {...} }
    //   // 根据实际接口返回格式调整
    //   const { token, data } = response
    //   
    //   token.value = token || data?.token
    //   user.value = data?.user || data
    //   isAuthenticated.value = true
    //   
    //   // 保存到 localStorage
    //   if (credentials.remember) {
    //     localStorage.setItem('admin_token', token.value)
    //     localStorage.setItem('admin_user', JSON.stringify(user.value))
    //   } else {
    //     // 使用 sessionStorage 临时存储
    //     sessionStorage.setItem('admin_token', token.value)
    //     sessionStorage.setItem('admin_user', JSON.stringify(user.value))
    //   }
    //   
    //   return response
    // } catch (error) {
    //   logout()
    //   throw error
    // }
    
    // 临时模拟登录：直接设置 token 和用户信息
    token.value = 'mock_token_' + Date.now()
    user.value = {
      username: credentials.username || '管理员',
      name: credentials.username || '管理员',
      id: Date.now()
    }
    isAuthenticated.value = true
    
    // 保存到 localStorage
    if (credentials.remember) {
      localStorage.setItem('admin_token', token.value)
      localStorage.setItem('admin_user', JSON.stringify(user.value))
    } else {
      // 使用 sessionStorage 临时存储
      sessionStorage.setItem('admin_token', token.value)
      sessionStorage.setItem('admin_user', JSON.stringify(user.value))
    }
    
    return {
      token: token.value,
      data: {
        user: user.value
      }
    }
  }

  const logout = () => {
    token.value = null
    user.value = null
    isAuthenticated.value = false
    
    // 清除存储
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_user')
  }

  // 初始化时从存储中恢复状态
  const initAuth = () => {
    const storedToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token')
    const storedUser = localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user')
    
    if (storedToken) {
      token.value = storedToken
      isAuthenticated.value = true
    }
    
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser)
      } catch (e) {
        console.error('Failed to parse user data:', e)
      }
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    isLoggedIn,
    login,
    logout,
    initAuth
  }
})

