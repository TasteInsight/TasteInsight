import request from '@/utils/request'
import type { 
  PaginationResponse,
  ApiResponse,
  Report,
  PendingReview,
  PendingComment
} from '@/types/api'

/**
 * 审核管理 API
 */
export const reviewApi = {
  /**
   * 获取待审核评价列表
   * @param params 分页参数
   * @returns 待审核评价列表
   */
  async getPendingReviews(params: { page?: number; pageSize?: number } = {}): Promise<ApiResponse<PaginationResponse<PendingReview>>> {
    const { page = 1, pageSize = 20 } = params;
    return await request.get<ApiResponse<PaginationResponse<PendingReview>>>('/admin/reviews/pending', { 
      params: { page, pageSize } 
    });
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
    const { page = 1, pageSize = 20 } = params;
    return await request.get<ApiResponse<PaginationResponse<PendingComment>>>('/admin/comments/pending', { 
      params: { page, pageSize } 
    });
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
    return await request.get<ApiResponse<PaginationResponse<Report>>>('/admin/reports', { params });
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
   * 获取上传菜品审核列表
   * @param params 分页参数和筛选参数
   * @returns 上传菜品审核列表
   */
  async getPendingUploads(params: { page?: number; pageSize?: number; status?: string } = {}): Promise<ApiResponse<any>> {
    return await request.get<ApiResponse<any>>('/admin/dishes/uploads', { params });
  },

  /**
   * 获取上传菜品审核详情
   * @param id 上传菜品 ID
   * @returns 上传菜品审核详情
   */
  async getPendingUploadById(id: string): Promise<ApiResponse<any>> {
    return await request.get<ApiResponse<any>>(`/admin/dishes/uploads/${id}`);
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
  },

  /**
   * 撤销用户上传菜品审核
   * @param id 上传菜品 ID
   * @returns 审核结果
   */
  async revokeUpload(id: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/dishes/uploads/${id}/revoke`);
  }
}

export default reviewApi
