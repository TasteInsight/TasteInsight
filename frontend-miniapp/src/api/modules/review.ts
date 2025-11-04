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
  return request<ApiResponse<ReviewListData>>({
    url: `/reviews/${dishId}`,
    method: 'GET',
  });
};

/**
 * 发布评价
 */
export const createReview = (
  reviewData: ReviewCreateRequest
): Promise<ApiResponse<Review>> => {
  return request<ApiResponse<Review>>({
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
): Promise<SuccessResponse> => {
  return request<SuccessResponse>({
    url: `/reviews/${reviewId}/report`,
    method: 'POST',
    data: reportData,
  });
};