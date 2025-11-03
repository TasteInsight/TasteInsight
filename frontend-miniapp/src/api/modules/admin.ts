// @/api/modules/admin.ts
import request from '@/utils/request';
import type {
  AdminLoginData,
  Admin,
  AdminCreateRequest,
  Dish,
  DishCreateRequest,
  DishUpdateRequest,
  PaginatedData,
  PendingReviewItem,
  PendingCommentItem,
  Report,
  ReportHandleRequest,
  PendingUploadItem,
  AdminListItem,
  OperationLog,
  News,
  NewsCreateRequest,
  NewsUpdateRequest,
} from '@/types/api';

// ============================================
// 认证相关
// ============================================

/**
 * 管理员登录
 */
export const adminLogin = (
  username: string,
  password: string
): Promise<AdminLoginData> => {
  return request<AdminLoginData>({
    url: '/auth/admin/login',
    method: 'POST',
    data: { username, password },
  });
};

// ============================================
// 菜品管理
// ============================================

/**
 * 管理端获取菜品列表
 */
export const adminGetDishes = (params?: {
  page?: number;
  pageSize?: number;
  canteenId?: string;
  status?: 'online' | 'offline';
  keyword?: string;
}): Promise<PaginatedData<Dish>> => {
  return request<PaginatedData<Dish>>({
    url: '/admin/dishes',
    method: 'GET',
    data: params,
  });
};

/**
 * 新建菜品
 */
export const adminCreateDish = (dishData: DishCreateRequest): Promise<Dish> => {
  return request<Dish>({
    url: '/admin/dishes',
    method: 'POST',
    data: dishData,
  });
};

/**
 * 编辑菜品
 */
export const adminUpdateDish = (
  dishId: string,
  dishData: DishUpdateRequest
): Promise<Dish> => {
  return request<Dish>({
    url: `/admin/dishes/${dishId}`,
    method: 'PUT',
    data: dishData,
  });
};

/**
 * 删除菜品
 */
export const adminDeleteDish = (dishId: string): Promise<null> => {
  return request<null>({
    url: `/admin/dishes/${dishId}`,
    method: 'DELETE',
  });
};

/**
 * 修改菜品状态
 * 注意：API文档中使用PATCH，但uni.request不支持，这里使用POST模拟
 */
export const adminUpdateDishStatus = (
  dishId: string,
  status: 'online' | 'offline'
): Promise<null> => {
  return request<null>({
    url: `/admin/dishes/${dishId}/status`,
    method: 'POST', // 实际应该是PATCH，但改用POST
    data: { status },
  });
};

// ============================================
// 审核管理
// ============================================

/**
 * 获取待审核评价列表
 */
export const adminGetPendingReviews = (params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedData<PendingReviewItem>> => {
  return request<PaginatedData<PendingReviewItem>>({
    url: '/admin/reviews/pending',
    method: 'GET',
    data: params,
  });
};

/**
 * 通过评价审核
 */
export const adminApproveReview = (reviewId: string): Promise<null> => {
  return request<null>({
    url: `/admin/reviews/${reviewId}/approve`,
    method: 'POST',
  });
};

/**
 * 拒绝评价审核
 */
export const adminRejectReview = (
  reviewId: string,
  reason: string
): Promise<null> => {
  return request<null>({
    url: `/admin/reviews/${reviewId}/reject`,
    method: 'POST',
    data: { reason },
  });
};

/**
 * 获取待审核评论列表
 */
export const adminGetPendingComments = (params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedData<PendingCommentItem>> => {
  return request<PaginatedData<PendingCommentItem>>({
    url: '/admin/comments/pending',
    method: 'GET',
    data: params,
  });
};

/**
 * 通过评论审核
 */
export const adminApproveComment = (commentId: string): Promise<null> => {
  return request<null>({
    url: `/admin/comments/${commentId}/approve`,
    method: 'POST',
  });
};

/**
 * 拒绝评论审核
 */
export const adminRejectComment = (
  commentId: string,
  reason: string
): Promise<null> => {
  return request<null>({
    url: `/admin/comments/${commentId}/reject`,
    method: 'POST',
    data: { reason },
  });
};

/**
 * 获取举报列表
 */
export const adminGetReports = (params?: {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'approved' | 'rejected';
}): Promise<PaginatedData<Report>> => {
  return request<PaginatedData<Report>>({
    url: '/admin/reports',
    method: 'GET',
    data: params,
  });
};

/**
 * 处理举报
 */
export const adminHandleReport = (
  reportId: string,
  handleData: ReportHandleRequest
): Promise<null> => {
  return request<null>({
    url: `/admin/reports/${reportId}/handle`,
    method: 'POST',
    data: handleData,
  });
};

/**
 * 获取待审核的用户上传菜品
 */
export const adminGetPendingUploads = (params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedData<PendingUploadItem>> => {
  return request<PaginatedData<PendingUploadItem>>({
    url: '/admin/dishes/uploads/pending',
    method: 'GET',
    data: params,
  });
};

/**
 * 通过用户上传菜品审核
 */
export const adminApproveUpload = (uploadId: string): Promise<null> => {
  return request<null>({
    url: `/admin/dishes/uploads/${uploadId}/approve`,
    method: 'POST',
  });
};

/**
 * 拒绝用户上传菜品审核
 */
export const adminRejectUpload = (
  uploadId: string,
  reason: string
): Promise<null> => {
  return request<null>({
    url: `/admin/dishes/uploads/${uploadId}/reject`,
    method: 'POST',
    data: { reason },
  });
};

// ============================================
// 权限管理
// ============================================

/**
 * 获取子管理员列表
 */
export const adminGetSubAdmins = (params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedData<AdminListItem>> => {
  return request<PaginatedData<AdminListItem>>({
    url: '/admin/admins',
    method: 'GET',
    data: params,
  });
};

/**
 * 创建子管理员
 */
export const adminCreateSubAdmin = (
  adminData: AdminCreateRequest
): Promise<AdminListItem> => {
  return request<AdminListItem>({
    url: '/admin/admins',
    method: 'POST',
    data: adminData,
  });
};

/**
 * 删除子管理员
 */
export const adminDeleteSubAdmin = (adminId: string): Promise<null> => {
  return request<null>({
    url: `/admin/admins/${adminId}`,
    method: 'DELETE',
  });
};

/**
 * 更新子管理员权限
 */
export const adminUpdatePermissions = (
  adminId: string,
  permissions: string[]
): Promise<null> => {
  return request<null>({
    url: `/admin/admins/${adminId}/permissions`,
    method: 'PUT',
    data: { permissions },
  });
};

// ============================================
// 日志管理
// ============================================

/**
 * 获取操作日志
 */
export const adminGetLogs = (params?: {
  page?: number;
  pageSize?: number;
  adminId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PaginatedData<OperationLog>> => {
  return request<PaginatedData<OperationLog>>({
    url: '/admin/logs',
    method: 'GET',
    data: params,
  });
};

// ============================================
// 新闻管理
// ============================================

/**
 * 管理端获取新闻列表
 */
export const adminGetNews = (params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedData<News>> => {
  return request<PaginatedData<News>>({
    url: '/admin/news',
    method: 'GET',
    data: params,
  });
};

/**
 * 创建新闻
 */
export const adminCreateNews = (newsData: NewsCreateRequest): Promise<News> => {
  return request<News>({
    url: '/admin/news',
    method: 'POST',
    data: newsData,
  });
};

/**
 * 编辑新闻
 */
export const adminUpdateNews = (
  newsId: string,
  newsData: NewsUpdateRequest
): Promise<News> => {
  return request<News>({
    url: `/admin/news/${newsId}`,
    method: 'PUT',
    data: newsData,
  });
};

/**
 * 删除新闻
 */
export const adminDeleteNews = (newsId: string): Promise<null> => {
  return request<null>({
    url: `/admin/news/${newsId}`,
    method: 'DELETE',
  });
};