// @/api/modules/news.ts
import request from '@/utils/request';
import type { News, PaginationParams, PaginatedData, ApiResponse } from '@/types/api';

/**
 * 获取新闻列表
 */
export const getNewsList = (params?: {
  page?: number;
  pageSize?: number;
  canteenId?: string;
}): Promise<ApiResponse<PaginatedData<News>>> => {
  return request<ApiResponse<PaginatedData<News>>>({
    url: '/news',
    method: 'GET',
  });
};

/**
 * 获取新闻详情
 */
export const getNewsById = (
  id: string
): Promise<ApiResponse<News>> => {
  return request<ApiResponse<News>>({
    url: `/news/${id}`,
    method: 'GET',
  });
};