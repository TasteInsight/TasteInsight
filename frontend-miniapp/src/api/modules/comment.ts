// @/api/modules/comment.ts
import request from '@/utils/request';
import type {
  Comment,
  CommentCreateRequest,
  ReportRequest,
  PaginationParams,
  PaginatedData,
  ApiResponse,
  SuccessResponse,
} from '@/types/api';

/**
 * 获取评论列表
 */
export const getCommentsByReview = (
  reviewId: string,
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<Comment>>> => {
  return request<PaginatedData<Comment>>({
    url: `/comments/${reviewId}`,
    method: 'GET',
    data: params,
  });
};

/**
 * 发布评论
 */
export const createComment = (
  commentData: CommentCreateRequest
): Promise<ApiResponse<Comment>> => {
  return request<Comment>({
    url: '/comments',
    method: 'POST',
    data: commentData,
  });
};

/**
 * 举报评论
 */
export const reportComment = (
  commentId: string,
  reportData: ReportRequest
): Promise<ApiResponse<null>> => {
  return request<null>({
    url: `/comments/${commentId}/report`,
    method: 'POST',
    data: reportData,
  });
};

/**
 * 删除评论
 */
export const deleteComment = (
  commentId: string
): Promise<ApiResponse<null>> => {
  return request<null>({
    url: `/comments/${commentId}`,
    method: 'DELETE',
  });
};