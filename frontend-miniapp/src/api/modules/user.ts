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
import { 
  USE_MOCK,
  mockWechatLogin,
  mockGetUserProfile,
  mockUpdateUserProfile,
  mockGetMyReviews,
  mockGetMyFavorites,
  mockGetBrowseHistory,
  mockClearBrowseHistory,
} from '@/mock';

export const wechatLogin = async (
  code : string
): Promise<ApiResponse<LoginData>> => {
  if (USE_MOCK) {
    const data = await mockWechatLogin(code);
    return {
      code: 200,
      message: '登录成功',
      data,
    };
  }
  return request<LoginData>({
    url: '/auth/wechat/login',
    method: 'POST',
    data: { code },
  });
};

/**
 * @summary 刷新Token
 * @description 使用当前Token刷新获取新Token
 * @returns {Promise<LoginResponse>}
 */
export const refreshToken = (
): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: '/auth/refresh',
    method: 'POST',
    data: { },
  });
};
/**
 * 获取用户信息
 */
export const getUserProfile = async (): Promise<ApiResponse<User>> => {
  if (USE_MOCK) {
    const data = await mockGetUserProfile();
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  return request<User>({
    url: '/user/profile',
    method: 'GET',
  });
};

/**
 * 更新用户信息
 */
export const updateUserProfile = async (
  profileData: UserProfileUpdateRequest
): Promise<ApiResponse<User>> => {
  if (USE_MOCK) {
    const data = await mockUpdateUserProfile(profileData);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  
  return request<User>({
    url: '/user/profile',
    method: 'PUT',
    data: profileData,
  });
};

/**
 * 获取我的评价
 */
export const getMyReviews = async (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<MyReviewItem>>> => {
  if (USE_MOCK) {
    const data = await mockGetMyReviews(params);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  return request<PaginatedData<MyReviewItem>>({
    url: '/user/reviews',
    method: 'GET',   
  });
};

/**
 * 获取我的收藏
 */
export const getMyFavorites = async (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<Favorite>>> => {
  if (USE_MOCK) {
    const data = await mockGetMyFavorites(params);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  return request<PaginatedData<Favorite>>({
    url: '/user/favorites',
    method: 'GET',
  });
};

/**
 * 获取浏览历史
 */
export const getBrowseHistory = async (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<BrowseHistoryItem>>> => {
  if (USE_MOCK) {
    const data = await mockGetBrowseHistory(params);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  return request<PaginatedData<BrowseHistoryItem>>({
    url: '/user/history',
    method: 'GET',
  });
};

/**
 * 清空浏览历史
 */
export const clearBrowseHistory = async (): Promise<ApiResponse<null>> => {
  if (USE_MOCK) {
    await mockClearBrowseHistory();
    return {
      code: 200,
      message: '清空成功',
      data: null,
    };
  }
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