// @/api/modules/news.ts
import request from '@/utils/request';
import type { News, PaginationParams, PaginatedData, ApiResponse } from '@/types/api';
import { USE_MOCK, mockGetNewsList, mockGetNewsById } from '@/mock';

/**
 * 获取新闻列表
 */
export const getNewsList = async (params?: {
  page?: number;
  pageSize?: number;
  canteenId?: string;
}): Promise<ApiResponse<PaginatedData<News>>> => {
  if (USE_MOCK) {
    const data = await mockGetNewsList(params);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }

  return request<PaginatedData<News>>({
    url: '/news',
    method: 'GET',
    data: params,
  });
};

/**
 * 获取新闻详情
 */
export const getNewsById = async (
  id: string
): Promise<ApiResponse<News>> => {
  if (USE_MOCK) {
    const news = await mockGetNewsById(id);

    if (!news) {
      return {
        code: 404,
        message: '新闻不存在',
        data: null as any,
      };
    }

    return {
      code: 200,
      message: 'Success',
      data: news,
    };
  }

  return request<News>({
    url: `/news/${id}`,
    method: 'GET',
  });
};