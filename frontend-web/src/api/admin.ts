import request from './request'
import type { Admin, CreateAdminData, UpdateAdminPermissionsData, GetAdminsParams, PaginationResponse } from './types'

/**
 * 管理员相关 API
 */
export const adminApi = {
  /**
   * 获取子管理员列表
   * @param params 查询参数（分页、筛选等）
   * @returns 管理员列表和分页信息
   */
  async getAdmins(params: GetAdminsParams = {}): Promise<PaginationResponse<Admin>> {
    const { page = 1, pageSize = 10, ...rest } = params
    
    // 构建查询字符串
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...Object.fromEntries(
        Object.entries(rest).filter(([_, value]) => value !== undefined && value !== null && value !== '')
      )
    })
    
    const response = await request.get<PaginationResponse<Admin>>(`/admin/admins?${queryParams.toString()}`)
    return response
  },

  /**
   * 创建子管理员
   * @param data 管理员数据
   * @returns 创建的管理员信息
   */
  async createAdmin(data: CreateAdminData): Promise<Admin> {
    const response = await request.post<Admin>('/admin/admins', {
      username: data.username,
      password: data.password,
      canteenId: data.canteenId,
      permissions: data.permissions || []
    })
    return response
  },

  /**
   * 删除子管理员
   * @param adminId 管理员 ID
   * @returns 删除结果
   */
  async deleteAdmin(adminId: string | number): Promise<{ success: boolean }> {
    const response = await request.delete<{ success: boolean }>(`/admin/admins/${adminId}`)
    return response
  },

  /**
   * 更新子管理员权限
   * @param adminId 管理员 ID
   * @param permissions 权限列表
   * @returns 更新结果
   */
  async updateAdminPermissions(
    adminId: string | number, 
    permissions: string[]
  ): Promise<{ success: boolean }> {
    const response = await request.put<{ success: boolean }>(
      `/admin/admins/${adminId}/permissions`,
      { permissions }
    )
    return response
  },

  /**
   * 重置管理员密码
   * @param adminId 管理员 ID
   * @returns 重置结果
   */
  async resetAdminPassword(adminId: string | number): Promise<{ success: boolean; newPassword?: string }> {
    const response = await request.post<{ success: boolean; newPassword?: string }>(
      `/admin/admins/${adminId}/reset-password`
    )
    return response
  }
}

export default adminApi

