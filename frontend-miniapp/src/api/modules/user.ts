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
  MyUserProfileResponse
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
export const getUserProfile = (
): Promise<ApiResponse<User>> => {
  return request<ApiResponse<User>>({
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
  return request<ApiResponse<User>>({
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
  return request<ApiResponse<PaginatedData<MyReviewItem>>>({
    url: '/user/reviews',
    method: 'GET',   
  });
};

/**
 * 获取我的收藏
 */
export const getMyFavorites = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<Favorite>>> => {
  return request<ApiResponse<PaginatedData<Favorite>>>({
    url: '/user/favorites',
    method: 'GET',
  });
};

/**
 * 获取浏览历史
 */
export const getBrowseHistory = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<BrowseHistoryItem>>> => {
  return request<ApiResponse<PaginatedData<BrowseHistoryItem>>>({
    url: '/user/history',
    method: 'GET',
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
): Promise<ApiResponse<PaginatedData<MyUploadItem>>> => {
  return request<ApiResponse<PaginatedData<MyUploadItem>>>({
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
  return request<ApiResponse<PaginatedData<Report>>>({
    url: '/user/reports',
    method: 'GET',
  });
};