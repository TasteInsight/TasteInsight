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

// ========== Mock 配置 ==========
// 设置为 true 启用 Mock 模式，false 使用真实后端
const USE_MOCK = true;

// Mock 用户数据
const createMockUser = (): User => ({
  id: 'mock_user_001',
  openId: 'mock_openid_123',
  nickname: '测试用户',
  avatar: 'https://via.placeholder.com/150',
  preferences: {
    id: 'pref_001',
    userId: 'mock_user_001',
    tastePreferences: {
      spiciness: 0,
      sweetness: 0,
      saltiness: 0,
      oiliness: 0,
    },
    portionSize: 'medium',
    meatPreference: [],
    priceRange: { min: 20, max: 100 },
    canteenPreferences: [],
    avoidIngredients: [],
    favoriteIngredients: [],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// 从本地存储获取 Mock 数据
const getMockUserFromStorage = (): User => {
  try {
    const stored = uni.getStorageSync('mock_user_profile');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('读取 Mock 数据失败:', e);
  }
  return createMockUser();
};

// 保存 Mock 数据到本地存储
const saveMockUserToStorage = (user: User): void => {
  try {
    uni.setStorageSync('mock_user_profile', JSON.stringify(user));
    console.log('✅ Mock 数据已保存到本地存储');
  } catch (e) {
    console.error('保存 Mock 数据失败:', e);
  }
};

// 模拟网络延迟
const mockDelay = (ms: number = 500) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Mock 登录数据
const createMockLoginData = (): LoginData => ({
  token: {
    accessToken: 'mock_access_token_' + Date.now(),
    refreshToken: 'mock_refresh_token_' + Date.now(),
  },
  user: createMockUser(),
});

// Mock 评价数据
const createMockReviews = (): MyReviewItem[] => [
  {
    id: 'review_001',
    userId: 'mock_user_001',
    dishId: 'dish_001',
    dishName: '宫保鸡丁',
    dishImage: 'https://via.placeholder.com/300',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/100',
    rating: 5,
    content: '味道很好，辣度适中，鸡肉很嫩！',
    images: ['https://via.placeholder.com/300'],
    status: 'approved',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'review_002',
    userId: 'mock_user_001',
    dishId: 'dish_002',
    dishName: '麻婆豆腐',
    dishImage: 'https://via.placeholder.com/300',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/100',
    rating: 4,
    content: '豆腐很嫩，麻辣味道正宗，就是有点咸。',
    images: [],
    status: 'approved',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'review_003',
    userId: 'mock_user_001',
    dishId: 'dish_003',
    dishName: '鱼香肉丝',
    dishImage: 'https://via.placeholder.com/300',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/100',
    rating: 5,
    content: '酸甜可口，非常下饭！',
    images: ['https://via.placeholder.com/300', 'https://via.placeholder.com/300'],
    status: 'approved',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

// Mock 收藏数据
const createMockFavorites = (): Favorite[] => [
  {
    dishId: 'dish_001',
    addedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    dishId: 'dish_004',
    addedAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    dishId: 'dish_005',
    addedAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

// Mock 浏览历史数据
const createMockHistory = (): BrowseHistoryItem[] => [
  {
    dishId: 'dish_001',
    viewedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    dishId: 'dish_002',
    viewedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    dishId: 'dish_003',
    viewedAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    dishId: 'dish_004',
    viewedAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    dishId: 'dish_005',
    viewedAt: new Date(Date.now() - 18000000).toISOString(),
  },
];

// 存储 Mock 数据的键
const STORAGE_KEYS = {
  USER: 'mock_user_profile',
  REVIEWS: 'mock_user_reviews',
  FAVORITES: 'mock_user_favorites',
  HISTORY: 'mock_user_history',
};

// 获取评价数据
const getMockReviews = (): MyReviewItem[] => {
  try {
    const stored = uni.getStorageSync(STORAGE_KEYS.REVIEWS);
    return stored ? JSON.parse(stored) : createMockReviews();
  } catch (e) {
    return createMockReviews();
  }
};

// 获取收藏数据
const getMockFavorites = (): Favorite[] => {
  try {
    const stored = uni.getStorageSync(STORAGE_KEYS.FAVORITES);
    return stored ? JSON.parse(stored) : createMockFavorites();
  } catch (e) {
    return createMockFavorites();
  }
};

// 获取浏览历史
const getMockHistory = (): BrowseHistoryItem[] => {
  try {
    const stored = uni.getStorageSync(STORAGE_KEYS.HISTORY);
    return stored ? JSON.parse(stored) : createMockHistory();
  } catch (e) {
    return createMockHistory();
  }
};

// 保存评价数据
const saveMockReviews = (reviews: MyReviewItem[]): void => {
  uni.setStorageSync(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
};

// 保存收藏数据
const saveMockFavorites = (favorites: Favorite[]): void => {
  uni.setStorageSync(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
};

// 保存浏览历史
const saveMockHistory = (history: BrowseHistoryItem[]): void => {
  uni.setStorageSync(STORAGE_KEYS.HISTORY, JSON.stringify(history));
};
// ========== End Mock 配置 ==========

export const wechatLogin = async (
  code : string
): Promise<ApiResponse<LoginData>> => {
  if (USE_MOCK) {
    await mockDelay(800);
    const mockLoginData = createMockLoginData();
    console.log('🔐 [Mock] 微信登录成功:', mockLoginData);
    // 保存用户信息到storage
    saveMockUserToStorage(mockLoginData.user!);
    return {
      code: 200,
      message: '登录成功',
      data: mockLoginData,
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
    await mockDelay(300);
    const mockUser = getMockUserFromStorage();
    console.log('📱 [Mock] 获取用户信息:', mockUser);
    return {
      code: 200,
      message: 'Success',
      data: mockUser,
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
    await mockDelay(500);
    const currentUser = getMockUserFromStorage();
    
    // 合并更新数据
    const updatedUser: User = {
      ...currentUser,
      nickname: profileData.nickname ?? currentUser.nickname,
      avatar: profileData.avatar ?? currentUser.avatar,
      updatedAt: new Date().toISOString(),
    };

    // 合并 preferences
    if (profileData.preferences && currentUser.preferences) {
      updatedUser.preferences = {
        ...currentUser.preferences,
        ...profileData.preferences,
        id: currentUser.preferences.id,
        userId: currentUser.preferences.userId,
      };
      
      // 深度合并 tastePreferences
      if (profileData.preferences.tastePreferences) {
        updatedUser.preferences.tastePreferences = {
          ...currentUser.preferences.tastePreferences,
          ...profileData.preferences.tastePreferences,
        };
      }
    }

    saveMockUserToStorage(updatedUser);
    console.log('✅ [Mock] 更新用户信息成功:', updatedUser);
    
    return {
      code: 200,
      message: 'Success',
      data: updatedUser,
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
    await mockDelay(400);
    const allReviews = getMockReviews();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = allReviews.slice(startIndex, endIndex);
    
    console.log(`📝 [Mock] 获取我的评价 (第${page}页):`, items);
    
    return {
      code: 200,
      message: 'Success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total: allReviews.length,
          totalPages: Math.ceil(allReviews.length / pageSize),
        },
      },
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
    await mockDelay(400);
    const allFavorites = getMockFavorites();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = allFavorites.slice(startIndex, endIndex);
    
    console.log(`⭐ [Mock] 获取我的收藏 (第${page}页):`, items);
    
    return {
      code: 200,
      message: 'Success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total: allFavorites.length,
          totalPages: Math.ceil(allFavorites.length / pageSize),
        },
      },
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
    await mockDelay(400);
    const allHistory = getMockHistory();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = allHistory.slice(startIndex, endIndex);
    
    console.log(`🕒 [Mock] 获取浏览历史 (第${page}页):`, items);
    
    return {
      code: 200,
      message: 'Success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total: allHistory.length,
          totalPages: Math.ceil(allHistory.length / pageSize),
        },
      },
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
    await mockDelay(300);
    uni.removeStorageSync(STORAGE_KEYS.HISTORY);
    console.log('🗑️ [Mock] 清空浏览历史成功');
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