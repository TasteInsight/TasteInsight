import request from '@/utils/request'
import type { 
  News,
  PaginationResponse,
  ApiResponse,
  NewsCreateRequest,
  NewsUpdateRequest
} from '@/types/api'

/**
 * 新闻管理 API
 */
export const newsApi = {
  /**
   * 获取新闻列表
   * @param params 分页参数
   * @returns 新闻列表
   */
  async getNews(params: { page?: number; pageSize?: number } = {}): Promise<ApiResponse<PaginationResponse<News>>> {
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
  }
}

export default newsApi
