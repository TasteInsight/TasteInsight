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
  MyUploadDetail,
  DishUserCreateRequest,
  DishUploadData,
  Report,
} from '@/types/api';

export const wechatLogin = (code: string, platform: 'mp-weixin' | 'app' = 'mp-weixin'): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: '/auth/wechat/login',
    method: 'POST',
    auth: 'none',
    data: { code, platform },
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
    data: params,
  });
};

export const getMyUpload = (id: string): Promise<ApiResponse<MyUploadDetail>> =>
  request<MyUploadDetail>({ url: `/user/uploads/${encodeURIComponent(id)}`, method: 'GET' });

export const updateMyUpload = (
  id: string,
  data: DishUserCreateRequest & { revision: number }
): Promise<ApiResponse<DishUploadData>> =>
  request<DishUploadData>({ url: `/user/uploads/${encodeURIComponent(id)}`, method: 'PATCH', data });

export const withdrawMyUpload = (id: string, revision: number): Promise<ApiResponse<null>> =>
  request<null>({
    url: `/user/uploads/${encodeURIComponent(id)}/withdraw`, method: 'POST', data: { revision },
  });

/**
 * 获取我的举报
 */
export const getMyReports = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<Report>>> => {
  return request<PaginatedData<Report>>({
    url: '/user/reports',
    method: 'GET',
    data: params,
  });
};
