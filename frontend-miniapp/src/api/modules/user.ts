// @/api/modules/user.ts
import request from '@/utils/request';
import type {
  User,
  LoginData,
  UserProfileUpdateRequest,
  PaginationParams,
  PaginatedData,
  MyReviewItem,
  Favorite,
  BrowseHistoryItem,
  MyUploadItem,
  Report,
} from '@/types/api';

/**
 * 微信登录
 */
export const wechatLogin = (code: string): Promise<LoginData> => {
  return request<LoginData>({
    url: '/auth/wechat/login',
    method: 'POST',
    data: { code },
  });
};

/**
 * 刷新Token
 */
export const refreshToken = (): Promise<LoginData> => {
  return request<LoginData>({
    url: '/auth/refresh',
    method: 'POST',
  });
};

/**
 * 获取用户信息
 */
export const getUserProfile = (): Promise<User> => {
  return request<User>({
    url: '/user/profile',
    method: 'GET',
  });
};

/**
 * 更新用户信息
 */
export const updateUserProfile = (
  profileData: UserProfileUpdateRequest
): Promise<User> => {
  return request<User>({
    url: '/user/profile',
    method: 'PUT',
    data: profileData,
  });
};

/**
 * 获取我的评价
 */
export const getMyReviews = (
  params?: PaginationParams
): Promise<PaginatedData<MyReviewItem>> => {
  return request<PaginatedData<MyReviewItem>>({
    url: '/user/reviews',
    method: 'GET',
    data: params,
  });
};

/**
 * 获取我的收藏
 */
export const getMyFavorites = (
  params?: PaginationParams
): Promise<PaginatedData<Favorite>> => {
  return request<PaginatedData<Favorite>>({
    url: '/user/favorites',
    method: 'GET',
    data: params,
  });
};

/**
 * 获取浏览历史
 */
export const getBrowseHistory = (
  params?: PaginationParams
): Promise<PaginatedData<BrowseHistoryItem>> => {
  return request<PaginatedData<BrowseHistoryItem>>({
    url: '/user/history',
    method: 'GET',
    data: params,
  });
};

/**
 * 清空浏览历史
 */
export const clearBrowseHistory = (): Promise<null> => {
  return request<null>({
    url: '/user/history',
    method: 'DELETE',
  });
};

/**
 * 获取我的上传
 */
export const getMyUploads = (
  params?: PaginationParams
): Promise<PaginatedData<MyUploadItem>> => {
  return request<PaginatedData<MyUploadItem>>({
    url: '/user/uploads',
    method: 'GET',
    data: params,
  });
};

/**
 * 获取我的举报
 */
export const getMyReports = (
  params?: PaginationParams
): Promise<PaginatedData<Report>> => {
  return request<PaginatedData<Report>>({
    url: '/user/reports',
    method: 'GET',
    data: params,
  });
};