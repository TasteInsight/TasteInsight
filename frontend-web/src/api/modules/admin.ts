import request from '@/utils/request'
import type { 
  Admin, 
  GetAdminsParams, 
  CreateAdminRequest,
  PaginationResponse,
  ApiResponse,
  Report,
  News,
  Canteen,
  Window,
  PendingReview,
  PendingComment
} from '@/types/api'

/**
 * 管理员相关 API
 */
export const adminApi = {
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
        Object.entries(rest).filter(([_, value]) => value !== undefined && value !== null && value !== '')
      )
    })
    
    return await request.get<ApiResponse<PaginationResponse<Admin>>>(`/admin/admins?${queryParams.toString()}`)
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
    return await request.delete<ApiResponse<void>>(`/admin/admins/${adminId}`);
  },

  /**
   * 更新子管理员权限
   * @param adminId 管理员 ID
   * @param permissions 权限列表
   * @returns 更新结果
   */
  async updateAdminPermissions(adminId: string, permissions: string[]): Promise<ApiResponse<void>> {
    return await request.put<ApiResponse<void>>(`/admin/admins/${adminId}/permissions`, { permissions });
  },

  /**
   * 获取待审核评价列表
   * @param params 分页参数
   * @returns 待审核评价列表
   */
  async getPendingReviews(params: { page?: number; pageSize?: number } = {}): Promise<ApiResponse<PaginationResponse<PendingReview>>> {
    const { page = 1, pageSize = 20 } = params
    return await request.get<ApiResponse<PaginationResponse<PendingReview>>>('/admin/reviews/pending', { 
      params: { page, pageSize } 
    })
  },

  /**
   * 通过评价审核
   * @param id 评价 ID
   * @returns 审核结果
   */
  async approveReview(id: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/reviews/${id}/approve`);
  },

  /**
   * 拒绝评价审核
   * @param id 评价 ID
   * @param reason 拒绝原因
   * @returns 审核结果
   */
  async rejectReview(id: string, reason: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/reviews/${id}/reject`, { reason });
  },

  /**
   * 获取待审核评论列表
   * @param params 分页参数
   * @returns 待审核评论列表
   */
  async getPendingComments(params: { page?: number; pageSize?: number } = {}): Promise<ApiResponse<PaginationResponse<PendingComment>>> {
    const { page = 1, pageSize = 20 } = params
    return await request.get<ApiResponse<PaginationResponse<PendingComment>>>('/admin/comments/pending', { 
      params: { page, pageSize } 
    })
  },

  /**
   * 通过评论审核
   * @param id 评论 ID
   * @returns 审核结果
   */
  async approveComment(id: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/comments/${id}/approve`);
  },

  /**
   * 拒绝评论审核
   * @param id 评论 ID
   * @param reason 拒绝原因
   * @returns 审核结果
   */
  async rejectComment(id: string, reason: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/comments/${id}/reject`, { reason });
  },

  /**
   * 获取举报列表
   * @param params 查询参数
   * @returns 举报列表
   */
  async getReports(params: { page?: number; pageSize?: number; status?: 'pending' | 'processing' | 'resolved' | 'rejected' } = {}): Promise<ApiResponse<PaginationResponse<Report>>> {
    return await request.get<ApiResponse<PaginationResponse<Report>>>('/admin/reports', { params })
  },

  /**
   * 处理举报
   * @param id 举报 ID
   * @param data 处理数据
   * @returns 处理结果
   */
  async handleReport(id: string, data: { action: 'approve' | 'reject'; reason?: string }): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/reports/${id}/handle`, data);
  },

  /**
   * 获取日志列表
   * @param params 查询参数
   * @returns 日志列表
   */
  async getLogs(params: { page?: number; pageSize?: number; action?: string; startTime?: string; endTime?: string } = {}): Promise<ApiResponse<PaginationResponse<any>>> {
    return await request.get<ApiResponse<PaginationResponse<any>>>('/admin/logs', { params })
  },

  /**
   * 获取新闻列表
   * @param params 分页参数
   * @returns 新闻列表
   */
  async getNews(params: { page?: number; pageSize?: number } = {}): Promise<ApiResponse<PaginationResponse<News>>> {
    return await request.get<ApiResponse<PaginationResponse<News>>>('/admin/news', { params })
  },

  /**
   * 获取食堂列表
   * @param params 分页参数
   * @returns 食堂列表
   */
  async getCanteens(params: { page?: number; pageSize?: number } = {}): Promise<ApiResponse<PaginationResponse<Canteen>>> {
    return await request.get<ApiResponse<PaginationResponse<Canteen>>>('/admin/canteens', { params })
  },

  /**
   * 获取窗口列表
   * @param params 查询参数
   * @returns 窗口列表
   */
  async getWindows(params: { page?: number; pageSize?: number; canteenId?: string } = {}): Promise<ApiResponse<PaginationResponse<Window>>> {
    return await request.get<ApiResponse<PaginationResponse<Window>>>('/admin/windows', { params })
  },

  /**
   * 获取待审核的用户上传菜品
   * @param params 分页参数
   * @returns 待审核菜品列表
   */
  async getPendingUploads(params: { page?: number; pageSize?: number } = {}): Promise<ApiResponse<any>> {
    return await request.get<ApiResponse<any>>('/admin/dishes/uploads/pending', { params })
  },

  /**
   * 通过用户上传菜品审核
   * @param id 上传菜品 ID
   * @returns 审核结果
   */
  async approveUpload(id: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/dishes/uploads/${id}/approve`);
  },

  /**
   * 拒绝用户上传菜品审核
   * @param id 上传菜品 ID
   * @param reason 拒绝原因
   * @returns 审核结果
   */
  async rejectUpload(id: string, reason: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/dishes/uploads/${id}/reject`, { reason });
  }
}

export default adminApi
