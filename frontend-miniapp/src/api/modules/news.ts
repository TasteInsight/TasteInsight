// @/api/modules/news.ts
import request from '@/utils/request';
import type { News, PaginatedData, ApiResponse } from '@/types/api';

/**
 * 获取新闻列表
 */
export const getNewsList = (params?: {
  page?: number;
  pageSize?: number;
  canteenId?: string;
}): Promise<ApiResponse<PaginatedData<News>>> => {
  return request<PaginatedData<News>>({
    url: '/news',
    method: 'GET',
    data: params,
  });
};

/**
 * 获取新闻详情
 */
export const getNewsById = (
  id: string
): Promise<ApiResponse<News>> => {
  return request<News>({
    url: `/news/${id}`,
    method: 'GET',
  });
};