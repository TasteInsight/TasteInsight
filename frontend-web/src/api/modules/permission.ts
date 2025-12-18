import request from '@/utils/request'
import type {
  Admin,
  GetAdminsParams,
  CreateAdminRequest,
  PaginationResponse,
  ApiResponse,
} from '@/types/api'

/**
 * 权限管理 API
 */
export const permissionApi = {
  /**
   * 获取子管理员列表
   * @param params 查询参数（分页、筛选等）
   * @returns 管理员列表和分页信息
   */
  async getAdmins(params: GetAdminsParams = {}): Promise<ApiResponse<PaginationResponse<Admin>>> {
    const { page = 1, pageSize = 10, ...rest } = params

    // 构建查询字符串
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...Object.fromEntries(
        Object.entries(rest).filter(
          ([_, value]) => value !== undefined && value !== null && value !== '',
        ),
      ),
    })

    return await request.get<ApiResponse<PaginationResponse<Admin>>>(
      `/admin/admins?${queryParams.toString()}`,
    )
  },

  /**
   * 创建子管理员
   * @param data 管理员数据
   * @returns 创建的管理员信息
   */
  async createAdmin(data: CreateAdminRequest): Promise<ApiResponse<Admin>> {
    return await request.post<ApiResponse<Admin>>('/admin/admins', data)
  },

  /**
   * 删除子管理员
   * @param adminId 管理员 ID
   * @returns 删除结果
   */
  async deleteAdmin(adminId: string): Promise<ApiResponse<void>> {
    return await request.delete<ApiResponse<void>>(`/admin/admins/${adminId}`)
  },

  /**
   * 更新子管理员权限
   * @param adminId 管理员 ID
   * @param permissions 权限列表
   * @param canteenId 管理范围（食堂ID），null 表示全校
   * @returns 更新结果
   */
  async updateAdminPermissions(
    adminId: string,
    permissions: string[],
    canteenId?: string | null,
  ): Promise<ApiResponse<void>> {
    return await request.put<ApiResponse<void>>(`/admin/admins/${adminId}/permissions`, {
      permissions,
      ...(canteenId !== undefined ? { canteenId } : {}),
    })
  },
}

export default permissionApi
