// Mock 评价服务
import type { ReviewListData, Comment, PaginationParams, PaginatedData, Review } from '@/types/api';
import {
  getReviewsByDishId,
  getCommentsByReviewId,
  getRatingDetailByDishId,
  addComment,
  addReview,
  removeReview,
  removeComment,
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
}): Promise<Review> => {
  await delay(500);
  
  // 创建新评价对象
  const newId = `review_${Date.now()}`;
  const newReview: Review = {
    id: newId,
    dishId: data.dishId,
    userId: 'mock_user_001',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/100',
    rating: data.rating,
    content: data.content,
    images: data.images || [],
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  // 保存到 mock 数据中
  addReview(newReview);
  console.log('[Mock] 创建评价:', newReview);
  
  return newReview;
};

/**
 * 创建评论（模拟）
 */
export const mockCreateComment = async (data: {
  reviewId: string;
  content: string;
}): Promise<Comment> => {
  await delay(500);
  
  // 创建新评论对象
  const newId = `comment_${Date.now()}`;
  const newComment: Comment = {
    id: newId,
    reviewId: data.reviewId,
    userId: 'mock_user_001',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/100',
    content: data.content,
    status: 'approved',
    createdAt: new Date().toISOString(),
  };
  
  // 保存到 mock 数据中
  addComment(newComment);
  console.log('[Mock] 创建评论:', newComment);
  
  return newComment;
};

/**
 * 删除评价（模拟）
 */
export const mockDeleteReview = async (reviewId: string): Promise<void> => {
  await delay(300);
  const success = removeReview(reviewId);
  if (!success) {
    throw new Error('评价不存在或删除失败');
  }
  console.log('[Mock] 删除评价:', reviewId);
};

/**
 * 删除评论（模拟）
 */
export const mockDeleteComment = async (commentId: string): Promise<void> => {
  await delay(300);
  const success = removeComment(commentId);
  if (!success) {
    throw new Error('评论不存在或删除失败');
  }
  console.log('[Mock] 删除评论:', commentId);
};

