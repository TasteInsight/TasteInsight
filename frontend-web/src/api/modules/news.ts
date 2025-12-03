import request from '@/utils/request'
import type { 
  News,
  PaginationResponse,
  ApiResponse,
  NewsCreateRequest,
  NewsUpdateRequest,
  GetNewsParams
} from '@/types/api'

/**
 * 新闻管理 API
 */
export const newsApi = {
  /**
   * 获取新闻列表
   * @param params 查询参数
   * @returns 新闻列表
   */
  async getNews(params: GetNewsParams = {}): Promise<ApiResponse<PaginationResponse<News>>> {
    return await request.get<ApiResponse<PaginationResponse<News>>>('/admin/news', { params });
  },

  /**
   * 创建新闻
   * @param data 新闻数据
   * @returns 创建的新闻信息
   */
  async createNews(data: NewsCreateRequest): Promise<ApiResponse<News>> {
    return await request.post<ApiResponse<News>>('/admin/news', data);
  },

  /**
   * 更新新闻
   * @param id 新闻 ID
   * @param data 更新的新闻数据
   * @returns 更新后的新闻信息
   */
  async updateNews(id: string, data: NewsUpdateRequest): Promise<ApiResponse<News>> {
    return await request.put<ApiResponse<News>>(`/admin/news/${id}`, data);
  },

  /**
   * 删除新闻
   * @param id 新闻 ID
   * @returns 删除结果
   */
  async deleteNews(id: string): Promise<ApiResponse<void>> {
    return await request.delete<ApiResponse<void>>(`/admin/news/${id}`);
  },

  /**
   * 发布新闻
   * @param id 新闻 ID
   * @returns 发布结果
   */
  async publishNews(id: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/news/${id}/publish`);
  },

  /**
   * 撤回已发布新闻
   * @param id 新闻 ID
   * @returns 撤回结果
   */
  async revokeNews(id: string): Promise<ApiResponse<void>> {
    return await request.post<ApiResponse<void>>(`/admin/news/${id}/revoke`);
  }
}

export default newsApi
