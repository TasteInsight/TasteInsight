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

/**
 * 获取菜品评价列表
 */
export const getReviewsByDish = (
  dishId: string,
  params?: PaginationParams
): Promise<ApiResponse<ReviewListData>> => {
  return request<ReviewListData>({
    url: `/dishes/${dishId}/reviews`,
    method: 'GET',
    data: params,
  });
};

/**
 * 发布评价
 */
export const createReview = (
  reviewData: ReviewCreateRequest
): Promise<ApiResponse<Review>> => {
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