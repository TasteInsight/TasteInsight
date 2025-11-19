// Mock 用户服务
import type {
  User,
  LoginData,
  UserProfileUpdateRequest,
  PaginationParams,
  PaginatedData,
  MyReviewItem,
  Favorite,
  BrowseHistoryItem,
} from '@/types/api';
import { 
  createMockUser, 
  createMockReviews, 
  createMockFavorites, 
  createMockHistory,
  STORAGE_KEYS 
} from '../data/user';

// 模拟网络延迟
const mockDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 600 + 200));

// 从存储获取用户数据
const getMockUserFromStorage = (): User => {
  try {
    const storedUser = uni.getStorageSync(STORAGE_KEYS.USER);
    if (storedUser) {
      console.log('📱 [Mock] 从存储加载用户数据');
      return storedUser;
    }
  } catch (e) {
    console.error('📱 [Mock] 读取存储失败:', e);
  }
  
  const newUser = createMockUser();
  try {
    uni.setStorageSync(STORAGE_KEYS.USER, newUser);
    console.log('📱 [Mock] 创建并保存新用户数据');
  } catch (e) {
    console.error('📱 [Mock] 保存存储失败:', e);
  }
  
  return newUser;
};

// 保存用户数据到存储
const saveMockUserToStorage = (user: User): void => {
  try {
    uni.setStorageSync(STORAGE_KEYS.USER, user);
    console.log('💾 [Mock] 用户数据已保存');
  } catch (e) {
    console.error('💾 [Mock] 保存失败:', e);
  }
};

// 微信登录
export const mockWechatLogin = async (code: string): Promise<LoginData> => {
  console.log('🔐 [Mock] 微信登录，code:', code);
  await mockDelay();
  
  const user = getMockUserFromStorage();
  const token = {
    accessToken: 'mock_access_token_' + Date.now(),
    refreshToken: 'mock_refresh_token_' + Date.now(),
  };
  
  console.log('✅ [Mock] 登录成功');
  return { token, user };
};

// 获取用户信息
export const mockGetUserProfile = async (): Promise<User> => {
  console.log('👤 [Mock] 获取用户信息');
  await mockDelay();
  
  const user = getMockUserFromStorage();
  console.log('✅ [Mock] 用户信息:', user.nickname);
  return user;
};

// 更新用户信息
export const mockUpdateUserProfile = async (data: UserProfileUpdateRequest): Promise<User> => {
  console.log('✏️ [Mock] 更新用户信息:', data);
  await mockDelay();
  
  const user = getMockUserFromStorage();
  const updatedUser: User = {
    ...user,
    ...(data.nickname && { nickname: data.nickname }),
    ...(data.avatar && { avatar: data.avatar }),
    ...(data.preferences && { 
      preferences: {
        ...user.preferences!,
        ...data.preferences,
      }
    }),
    updatedAt: new Date().toISOString(),
  };
  
  saveMockUserToStorage(updatedUser);
  console.log('✅ [Mock] 用户信息已更新');
  return updatedUser;
};

// 获取我的评价
export const mockGetMyReviews = async (params?: PaginationParams): Promise<PaginatedData<MyReviewItem>> => {
  console.log('📝 [Mock] 获取我的评价');
  await mockDelay();
  
  try {
    const storedReviews = uni.getStorageSync(STORAGE_KEYS.REVIEWS);
    const reviews = storedReviews || createMockReviews();
    
    if (!storedReviews) {
      uni.setStorageSync(STORAGE_KEYS.REVIEWS, reviews);
    }
    
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    console.log(`✅ [Mock] 返回评价列表 (第${page}页)`);
    return {
      items: reviews.slice(start, end),
      meta: {
        page,
        pageSize,
        total: reviews.length,
        totalPages: Math.ceil(reviews.length / pageSize),
      },
    };
  } catch (e) {
    console.error('❌ [Mock] 获取评价失败:', e);
    return {
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    };
  }
};

// 获取我的收藏
export const mockGetMyFavorites = async (params?: PaginationParams): Promise<PaginatedData<Favorite>> => {
  console.log('⭐ [Mock] 获取我的收藏');
  await mockDelay();
  
  try {
    const storedFavorites = uni.getStorageSync(STORAGE_KEYS.FAVORITES);
    const favorites = storedFavorites || createMockFavorites();
    
    if (!storedFavorites) {
      uni.setStorageSync(STORAGE_KEYS.FAVORITES, favorites);
    }
    
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    console.log(`✅ [Mock] 返回收藏列表 (第${page}页)`);
    return {
      items: favorites.slice(start, end),
      meta: {
        page,
        pageSize,
        total: favorites.length,
        totalPages: Math.ceil(favorites.length / pageSize),
      },
    };
  } catch (e) {
    console.error('❌ [Mock] 获取收藏失败:', e);
    return {
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    };
  }
};

// 获取浏览历史
export const mockGetBrowseHistory = async (params?: PaginationParams): Promise<PaginatedData<BrowseHistoryItem>> => {
  console.log('🕒 [Mock] 获取浏览历史');
  await mockDelay();
  
  try {
    const storedHistory = uni.getStorageSync(STORAGE_KEYS.HISTORY);
    const history = storedHistory || createMockHistory();
    
    if (!storedHistory) {
      uni.setStorageSync(STORAGE_KEYS.HISTORY, history);
    }
    
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    console.log(`✅ [Mock] 返回浏览历史 (第${page}页)`);
    return {
      items: history.slice(start, end),
      meta: {
        page,
        pageSize,
        total: history.length,
        totalPages: Math.ceil(history.length / pageSize),
      },
    };
  } catch (e) {
    console.error('❌ [Mock] 获取历史失败:', e);
    return {
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    };
  }
};

// 清空浏览历史
export const mockClearBrowseHistory = async (): Promise<void> => {
  console.log('🗑️ [Mock] 清空浏览历史');
  await mockDelay();
  
  try {
    uni.removeStorageSync(STORAGE_KEYS.HISTORY);
    console.log('✅ [Mock] 浏览历史已清空');
  } catch (e) {
    console.error('❌ [Mock] 清空历史失败:', e);
  }
};
