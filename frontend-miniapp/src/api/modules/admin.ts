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

  Canteen,
  Window,
  CanteenListData,
  WindowListData,
  PaginationParams,
  CanteenCreateRequest,
  CanteenUpdateRequest,
  WindowCreateRequest,
  WindowUpdateRequest,
  SuccessResponse,
} from '@/types/api';

import type { ApiResponse } from '@/types/api';

// ============================================
// 认证相关
// ============================================

/**
 * 管理员登录
 */
export const adminLogin = (
  username: string,
  password: string
): Promise<ApiResponse<AdminLoginData>> => {
  return request<ApiResponse<AdminLoginData>>({
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
}): Promise<ApiResponse<PaginatedData<Dish>>> => {
  return request<ApiResponse<PaginatedData<Dish>>>({
    url: '/admin/dishes',
    method: 'GET',
  });
};

/**
 * 新建菜品
 */
export const adminCreateDish = (dishData: DishCreateRequest): Promise<ApiResponse<Dish>> => {
  return request<ApiResponse<Dish>>({
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
): Promise<ApiResponse<Dish>> => {
  return request<ApiResponse<Dish>>({
    url: `/admin/dishes/${dishId}`,
    method: 'PUT',
    data: dishData,
  });
};

/**
 * 删除菜品
 */
export const adminDeleteDish = (dishId: string): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
}): Promise<ApiResponse<PaginatedData<PendingReviewItem>>> => {
  return request<ApiResponse<PaginatedData<PendingReviewItem>>>({
    url: '/admin/reviews/pending',
    method: 'GET',
  });
};

/**
 * 通过评价审核
 */
export const adminApproveReview = (reviewId: string): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
}): Promise<ApiResponse<PaginatedData<PendingCommentItem>>> => {
  return request<ApiResponse<PaginatedData<PendingCommentItem>>>({
    url: '/admin/comments/pending',
    method: 'GET',
  });
};

/**
 * 通过评论审核
 */
export const adminApproveComment = (commentId: string): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
}): Promise<ApiResponse<PaginatedData<Report>>> => {
  return request<ApiResponse<PaginatedData<Report>>>({
    url: '/admin/reports',
    method: 'GET',
  });
};

/**
 * 处理举报
 */
export const adminHandleReport = (
  reportId: string,
  handleData: ReportHandleRequest
): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
}): Promise<ApiResponse<PaginatedData<PendingUploadItem>>> => {
  return request<ApiResponse<PaginatedData<PendingUploadItem>>>({
    url: '/admin/dishes/uploads/pending',
    method: 'GET',
  });
};

/**
 * 通过用户上传菜品审核
 */
export const adminApproveUpload = (uploadId: string): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
}): Promise<ApiResponse<PaginatedData<AdminListItem>>> => {
  return request<ApiResponse<PaginatedData<AdminListItem>>>({
    url: '/admin/admins',
    method: 'GET',
  });
};

/**
 * 创建子管理员
 */
export const adminCreateSubAdmin = (
  adminData: AdminCreateRequest
): Promise<ApiResponse<AdminListItem>> => {
  return request<ApiResponse<AdminListItem>>({
    url: '/admin/admins',
    method: 'POST',
    data: adminData,
  });
};

/**
 * 删除子管理员
 */
export const adminDeleteSubAdmin = (adminId: string): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
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
}): Promise<ApiResponse<PaginatedData<OperationLog>>> => {
  return request<ApiResponse<PaginatedData<OperationLog>>>({
    url: '/admin/logs',
    method: 'GET',
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
}): Promise<ApiResponse<PaginatedData<News>>> => {
  return request<ApiResponse<PaginatedData<News>>>({
    url: '/admin/news',
    method: 'GET',
  });
};

/**
 * 创建新闻
 */
export const adminCreateNews = (newsData: NewsCreateRequest): Promise<ApiResponse<News>> => {
  return request<ApiResponse<News>>({
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
): Promise<ApiResponse<News>> => {
  return request<ApiResponse<News>>({
    url: `/admin/news/${newsId}`,
    method: 'PUT',
    data: newsData,
  });
};

/**
 * 删除新闻
 */
export const adminDeleteNews = (newsId: string): Promise<ApiResponse<null>> => {
  return request<ApiResponse<null>>({
    url: `/admin/news/${newsId}`,
    method: 'DELETE',
  });
};


/**
 * 管理端获取食堂列表
 */
export function adminGetCanteenList(params?: PaginationParams): Promise<ApiResponse<CanteenListData>> {
  return request({
    url: '/admin/canteens',
    method: 'GET',
    data:params,
  });
}

/**
 * 管理端获取窗口列表
 */
export function adminGetWindowList(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowListData>> {
  return request({
    url: `/admin/windows/${canteenId}`,
    method: 'GET',
    data:params,
  });
}

/**
 * 新建食堂
 */
export function createCanteen(data: CanteenCreateRequest): Promise<ApiResponse<Canteen>> {
  return request({
    url: '/admin/canteens',
    method: 'POST',
    data,
  });
}

/**
 * 编辑食堂
 */
export function updateCanteen(id: string, data: CanteenUpdateRequest): Promise<ApiResponse<Canteen>> {
  return request({
    url: `/admin/canteens/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除食堂
 */
export function deleteCanteen(id: string): Promise<ApiResponse<null>> {
  return request({
    url: `/admin/canteens/${id}`,
    method: 'DELETE',
  });
}

/**
 * 新建窗口
 */
export function createWindow(data: WindowCreateRequest): Promise<ApiResponse<Window>> {
  return request({
    url: '/admin/windows',
    method: 'POST',
    data,
  });
}

/**
 * 编辑窗口
 */
export function updateWindow(id: string, data: WindowUpdateRequest): Promise<ApiResponse<Window>> {
  return request({
    url: `/admin/windows/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除窗口
 */
export function deleteWindow(id: string): Promise<ApiResponse<null>> {
  return request({
    url: `/admin/windows/${id}`,
    method: 'DELETE',
  });
}