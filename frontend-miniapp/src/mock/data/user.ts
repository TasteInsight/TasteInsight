// Mock 用户数据
import type { User, MyReviewItem, Favorite, BrowseHistoryItem } from '@/types/api';

// 存储键名
export const STORAGE_KEYS = {
  USER: 'mock_user_profile',
  REVIEWS: 'mock_user_reviews',
  FAVORITES: 'mock_user_favorites',
  HISTORY: 'mock_user_history',
};

// 创建 Mock 用户
export const createMockUser = (): User => ({
  id: 'mock_user_001',
  openId: 'mock_openid_123',
  nickname: '测试用户',
  avatar: 'https://via.placeholder.com/150',
  preferences: {
    id: 'pref_001',
    userId: 'mock_user_001',
    tastePreferences: {
      spicileval: 0,
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
  myFavoriteDishes: ['dish_001', 'dish_003', 'dish_005'],
  myReviews: [],
  myComments: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// 创建 Mock 评价列表
export const createMockReviews = (): MyReviewItem[] => [
  {
    id: 'review_001',
    dishId: 'dish_001',
    dishName: '宫保鸡丁',
    dishImage: 'https://via.placeholder.com/150',
    userId: 'mock_user_001',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/150',
    rating: 5,
    content: '非常好吃，鸡丁很嫩，花生很脆！',
    images: ['https://via.placeholder.com/300'],
    status: 'approved',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'review_002',
    dishId: 'dish_002',
    dishName: '麻婆豆腐',
    dishImage: 'https://via.placeholder.com/150',
    userId: 'mock_user_001',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/150',
    rating: 4,
    content: '味道不错，就是有点辣',
    images: [],
    status: 'approved',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'review_003',
    dishId: 'dish_003',
    dishName: '鱼香肉丝',
    dishImage: 'https://via.placeholder.com/150',
    userId: 'mock_user_001',
    userNickname: '测试用户',
    userAvatar: 'https://via.placeholder.com/150',
    rating: 5,
    content: '超级好吃！！！',
    images: ['https://via.placeholder.com/300', 'https://via.placeholder.com/300'],
    status: 'approved',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// 创建 Mock 收藏列表
export const createMockFavorites = (): Favorite[] => [
  {
    dishId: 'dish_001',
    addedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    dishId: 'dish_003',
    addedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    dishId: 'dish_005',
    addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// 创建 Mock 浏览历史
export const createMockHistory = (): BrowseHistoryItem[] => [
  {
    dishId: 'dish_001',
    viewedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    dishId: 'dish_002',
    viewedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    dishId: 'dish_003',
    viewedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    dishId: 'dish_004',
    viewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    dishId: 'dish_005',
    viewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];
