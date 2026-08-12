import request from '@/utils/request'
import type { LoginCredentials, AdminLoginResponse, TokenInfo, ApiResponse } from '@/types/api'

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 管理员登录
   * @param credentials 登录凭证
   * @returns 登录响应（包含 token、管理员信息和权限）
   */
  async adminLogin(credentials: LoginCredentials): Promise<ApiResponse<AdminLoginResponse>> {
    const response = await request.post<ApiResponse<AdminLoginResponse>>(
      '/auth/admin/login',
      credentials,
    )
    return response
  },

  /**
   * 刷新 Token
   * @param refreshToken 当前 refresh token
   * @returns 新的 token 信息
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<{ token: TokenInfo }>> {
    const response = await request.post<ApiResponse<{ token: TokenInfo }>>(
      '/auth/refresh',
      undefined,
      { headers: { Authorization: `Bearer ${refreshToken}` } },
    )
    return response
  },
}

export default authApi
