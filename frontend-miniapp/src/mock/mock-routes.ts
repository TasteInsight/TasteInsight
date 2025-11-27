/**
 * Mock 路由注册
 * 
 * 在这里注册所有的 mock 路由
 * 每个路由将 URL 模式映射到对应的 mock 处理函数
 */

import { registerMockRoute, mockSuccess } from './mock-adapter';
import type { RequestOptions, PaginationParams } from '@/types/api';

// ============================================
// 导入 Mock 数据服务
// ============================================
import { mockGetReviewsByDish, mockCreateReview } from './services/review';
import { mockGetDishById, mockGetDishes } from './services/dish';
import { mockGetCanteenList, mockGetCanteenDetail, mockGetWindowList, mockGetWindowDetail, mockGetWindowDishes, mockSearchDishes } from './services/canteen';
import { mockGetNewsList, mockGetNewsById } from './services/news';
import { 
  mockGetMealPlans, 
  mockCreateOrUpdateMealPlan, 
  mockDeleteMealPlan,
  mockExecutePlan,
} from './services/meal-plan';
import { 
  mockWechatLogin, 
  mockGetUserProfile, 
  mockUpdateUserProfile,
  mockGetMyReviews,
  mockGetMyFavorites,
  mockGetBrowseHistory,
} from './services/user';

// ============================================
// Review 相关路由
// ============================================

// GET /dishes/:dishId/reviews - 获取菜品评价列表
registerMockRoute('GET', '/dishes/:dishId/reviews', async (url, options) => {
  // 从 URL 提取 dishId
  const match = url.match(/\/dishes\/([^/]+)\/reviews/);
  const dishId = match?.[1] || '';
  const params = options.data as PaginationParams;
  
  const data = await mockGetReviewsByDish(dishId, params);
  return mockSuccess(data);
});

// POST /reviews - 创建评价
registerMockRoute('POST', '/reviews', async (url, options) => {
  const reviewData = options.data as any;
  const result = await mockCreateReview({
    dishId: reviewData.dishId,
    rating: reviewData.rating,
    content: reviewData.content || '',
    images: reviewData.images,
  });
  
  // 构造完整的 Review 对象返回
  const mockReview = {
    id: result.id,
    dishId: reviewData.dishId,
    userId: 'mock_user',
    userNickname: '当前用户',
    userAvatar: 'https://via.placeholder.com/100',
    rating: reviewData.rating,
    content: reviewData.content || '',
    images: reviewData.images || [],
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  };
  
  return mockSuccess(mockReview);
});

// ============================================
// Dish 相关路由
// ============================================

// GET /dishes/search - 搜索菜品（必须在 /dishes/:id 之前注册）
registerMockRoute('GET', '/dishes/search', async (url, options) => {
  const params = options.data as any;
  const data = await mockSearchDishes(params.keyword || params.query || '');
  return mockSuccess(data);
});

// GET /dishes/:id - 获取菜品详情
registerMockRoute('GET', '/dishes/:id', async (url) => {
  const match = url.match(/\/dishes\/([^/]+)$/);
  const dishId = match?.[1] || '';
  
  const data = await mockGetDishById(dishId);
  return mockSuccess(data);
});

// POST /dishes - 获取菜品列表
registerMockRoute('POST', '/dishes', async (url, options) => {
  const params = options.data as any;
  const data = await mockGetDishes(params);
  return mockSuccess(data);
});

// ============================================
// Canteen 相关路由
// ============================================

// GET /canteens - 获取食堂列表
registerMockRoute('GET', '/canteens', async () => {
  const data = await mockGetCanteenList();
  return mockSuccess(data);
});

// GET /canteens/:canteenId/windows - 获取窗口列表（必须在 /canteens/:id 之前）
registerMockRoute('GET', '/canteens/:canteenId/windows', async (url) => {
  const match = url.match(/\/canteens\/([^/]+)\/windows/);
  const canteenId = match?.[1] || '';
  
  const data = await mockGetWindowList(canteenId);
  return mockSuccess(data);
});

// GET /canteens/:id - 获取食堂详情
registerMockRoute('GET', '/canteens/:id', async (url) => {
  const match = url.match(/\/canteens\/([^/]+)$/);
  const canteenId = match?.[1] || '';
  
  const data = await mockGetCanteenDetail(canteenId);
  return mockSuccess(data);
});

// GET /windows/:windowId/dishes - 获取窗口菜品（必须在 /windows/:windowId 之前）
registerMockRoute('GET', '/windows/:windowId/dishes', async (url) => {
  const match = url.match(/\/windows\/([^/]+)\/dishes/);
  const windowId = match?.[1] || '';
  
  const data = await mockGetWindowDishes(windowId);
  return mockSuccess(data);
});

// GET /windows/:windowId - 获取窗口详情
registerMockRoute('GET', '/windows/:windowId', async (url) => {
  const match = url.match(/\/windows\/([^/]+)$/);
  const windowId = match?.[1] || '';
  
  const data = await mockGetWindowDetail(windowId);
  return mockSuccess(data);
});

// ============================================
// News 相关路由
// ============================================

// GET /news - 获取新闻列表
registerMockRoute('GET', '/news', async (url, options) => {
  const params = options.data as PaginationParams;
  const data = await mockGetNewsList(params);
  return mockSuccess(data);
});

// GET /news/:id - 获取新闻详情
registerMockRoute('GET', '/news/:id', async (url) => {
  const match = url.match(/\/news\/([^/]+)$/);
  const newsId = match?.[1] || '';
  
  const data = await mockGetNewsById(newsId);
  return mockSuccess(data);
});

// ============================================
// Meal Plan 相关路由
// ============================================

// GET /meal-plans - 获取用餐计划列表
registerMockRoute('GET', '/meal-plans', async () => {
  const items = await mockGetMealPlans();
  return mockSuccess({ items });
});

// POST /meal-plans/:id/execute - 执行用餐计划（必须在 POST /meal-plans 之前）
registerMockRoute('POST', '/meal-plans/:id/execute', async (url) => {
  const match = url.match(/\/meal-plans\/([^/]+)\/execute/);
  const planId = match?.[1] || '';
  
  const data = await mockExecutePlan(planId);
  return mockSuccess(data);
});

// POST /meal-plans - 创建/更新用餐计划
registerMockRoute('POST', '/meal-plans', async (url, options) => {
  const planData = options.data as any;
  const data = await mockCreateOrUpdateMealPlan(planData);
  return mockSuccess(data);
});

// DELETE /meal-plans/:id - 删除用餐计划
registerMockRoute('DELETE', '/meal-plans/:id', async (url) => {
  const match = url.match(/\/meal-plans\/([^/]+)$/);
  const planId = match?.[1] || '';
  
  await mockDeleteMealPlan(planId);
  return mockSuccess(null);
});

// ============================================
// User 相关路由
// ============================================

// POST /auth/wechat/login - 微信登录
registerMockRoute('POST', '/auth/wechat/login', async (url, options) => {
  const loginData = options.data as any;
  const data = await mockWechatLogin(loginData.code);
  return mockSuccess(data);
});

// GET /user/profile - 获取用户信息
registerMockRoute('GET', '/user/profile', async () => {
  const data = await mockGetUserProfile();
  return mockSuccess(data);
});

// PUT /user/profile - 更新用户信息
registerMockRoute('PUT', '/user/profile', async (url, options) => {
  const profileData = options.data as any;
  const data = await mockUpdateUserProfile(profileData);
  return mockSuccess(data);
});

// GET /user/reviews - 获取我的评价
registerMockRoute('GET', '/user/reviews', async (url, options) => {
  const params = options.data as PaginationParams;
  const data = await mockGetMyReviews(params);
  return mockSuccess(data);
});

// GET /user/favorites - 获取我的收藏
registerMockRoute('GET', '/user/favorites', async (url, options) => {
  const params = options.data as PaginationParams;
  const data = await mockGetMyFavorites(params);
  return mockSuccess(data);
});

// GET /user/history - 获取浏览历史
registerMockRoute('GET', '/user/history', async (url, options) => {
  const params = options.data as PaginationParams;
  const data = await mockGetBrowseHistory(params);
  return mockSuccess(data);
});

console.log('[Mock] 路由注册完成');
