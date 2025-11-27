// @/api/modules/review.ts
import request from '@/utils/request';
import type {
  Review,
  ReviewCreateRequest,
  ReportRequest,
  PaginationParams,
  ReviewListData,
  ApiResponse,
  SuccessResponse,
} from '@/types/api';
import { USE_MOCK, mockGetReviewsByDish, mockCreateReview } from '@/mock';

/**
 * 获取菜品评价列表
 */
export const getReviewsByDish = async (
  dishId: string,
  params?: PaginationParams
): Promise<ApiResponse<ReviewListData>> => {
  if (USE_MOCK) {
    const data = await mockGetReviewsByDish(dishId, params);
    return { code: 200, message: 'success', data };
  }
  return request<ReviewListData>({
    url: `/dishes/${dishId}/reviews`,
    method: 'GET',
    data: params,
  });
};

/**
 * 发布评价
 */
export const createReview = async (
  reviewData: ReviewCreateRequest
): Promise<ApiResponse<Review>> => {
  if (USE_MOCK) {
    const result = await mockCreateReview({
      dishId: reviewData.dishId,
      rating: reviewData.rating,
      content: reviewData.content || '',
      images: reviewData.images,
    });
    // 返回模拟的 Review 对象
    const mockReview: Review = {
      id: result.id,
      dishId: reviewData.dishId,
      userId: 'mock_user',
      userNickname: '当前用户',
      userAvatar: 'https://via.placeholder.com/100',
      rating: reviewData.rating,
      content: reviewData.content || '',
      images: reviewData.images || [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    return { code: 200, message: 'success', data: mockReview };
  }
  return request<Review>({
    url: '/reviews',
    method: 'POST',
    data: reviewData,
  });
};

/**
 * 举报评价
 */
export const reportReview = (
  reviewId: string,
  reportData: ReportRequest
): Promise<ApiResponse<null>> => {
  return request<null>({
    url: `/reviews/${reviewId}/report`,
    method: 'POST',
    data: reportData,
  });
};