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
  ApiResponse,
  BrowseHistoryItem,
  MyUploadItem,
  Report,
} from '@/types/api';

export const wechatLogin = (
  code: string
): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: '/auth/wechat/login',
    method: 'POST',
    data: { code },
  });
};

/**
 * @summary 刷新Token
 * @description 使用当前Token刷新获取新Token
 */
export const refreshToken = (): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: '/auth/refresh',
    method: 'POST',
    data: {},
  });
};

/**
 * 获取用户信息
 */
export const getUserProfile = (): Promise<ApiResponse<User>> => {
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
): Promise<ApiResponse<User>> => {
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
): Promise<ApiResponse<PaginatedData<MyReviewItem>>> => {
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
): Promise<ApiResponse<PaginatedData<Favorite>>> => {
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
): Promise<ApiResponse<PaginatedData<BrowseHistoryItem>>> => {
  return request<PaginatedData<BrowseHistoryItem>>({
    url: '/user/history',
    method: 'GET',
    data: params,
  });
};

/**
 * 清空浏览历史
 */
export const clearBrowseHistory = (): Promise<ApiResponse<null>> => {
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
): Promise<ApiResponse<PaginatedData<MyUploadItem>>> => {
  return request<PaginatedData<MyUploadItem>>({
    url: '/user/uploads',
    method: 'GET',
  });
};

/**
 * 获取我的举报
 */
export const getMyReports = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<Report>>> => {
  return request<PaginatedData<Report>>({
    url: '/user/reports',
    method: 'GET',
  });
};