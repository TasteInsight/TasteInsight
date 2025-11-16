import request from '@/utils/request'
import type { LoginCredentials, LoginResponse } from '@/types/api'

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 管理员登录
   * @param credentials 登录凭证
   * @returns 登录响应（包含 token 和用户信息）
   */
  async adminLogin(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await request.post<LoginResponse>('/auth/admin/login', {
      username: credentials.username,
      password: credentials.password
    })
    return response
  },

  /**
   * 管理员登出
   * @returns 登出响应
   */
  async adminLogout(): Promise<void> {
    await request.post('/auth/admin/logout')
  },

  /**
   * 刷新 token
   * @returns 新的 token
   */
  async refreshToken(): Promise<{ token: string }> {
    const response = await request.post<{ token: string }>('/auth/admin/refresh')
    return response
  }
}

export default authApi
