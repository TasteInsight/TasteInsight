// Mock 评价服务
import type { ReviewListData, Comment, PaginationParams, PaginatedData } from '@/types/api';
import {
  getReviewsByDishId,
  getCommentsByReviewId,
  getRatingDetailByDishId,
} from '../data/review';

// 模拟网络延迟
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 获取菜品评价列表
 */
export const mockGetReviewsByDish = async (
  dishId: string,
  params?: PaginationParams
): Promise<ReviewListData> => {
  await delay();

  const allReviews = getReviewsByDishId(dishId);
  const ratingDetail = getRatingDetailByDishId(dishId);

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 10;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedReviews = allReviews.slice(startIndex, endIndex);

  // 为每个评价添加评论数量
  const reviewsWithComments = paginatedReviews.map(review => ({
    ...review,
    commentCount: getCommentsByReviewId(review.id).length,
  }));

  const totalPages = Math.ceil(allReviews.length / pageSize);

  return {
    items: reviewsWithComments,
    meta: {
      page,
      pageSize,
      total: allReviews.length,
      totalPages,
    },
    rating: {
      average: ratingDetail.average,
      total: ratingDetail.total,
      detail: ratingDetail.detail,
    },
  };
};

/**
 * 获取评价的评论列表
 */
export const mockGetCommentsByReview = async (
  reviewId: string,
  params?: PaginationParams
): Promise<{ items: Comment[]; total: number; page: number; pageSize: number; hasMore: boolean }> => {
  await delay();

  const allComments = getCommentsByReviewId(reviewId);

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 10;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedComments = allComments.slice(startIndex, endIndex);

  return {
    items: paginatedComments,
    total: allComments.length,
    page,
    pageSize,
    hasMore: endIndex < allComments.length,
  };
};

/**
 * 创建评价（模拟）
 */
export const mockCreateReview = async (data: {
  dishId: string;
  rating: number;
  content: string;
  images?: string[];
}): Promise<{ id: string }> => {
  await delay(500);
  
  // 模拟创建成功，返回新ID
  const newId = `review_${Date.now()}`;
  console.log('[Mock] 创建评价:', { ...data, id: newId });
  
  return { id: newId };
};

/**
 * 创建评论（模拟）
 */
export const mockCreateComment = async (data: {
  reviewId: string;
  content: string;
}): Promise<{ id: string }> => {
  await delay(500);
  
  // 模拟创建成功，返回新ID
  const newId = `comment_${Date.now()}`;
  console.log('[Mock] 创建评论:', { ...data, id: newId });
  
  return { id: newId };
};
