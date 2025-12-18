/**
 * Mock 路由注册
 * 
 * 在这里注册所有的 mock 路由
 * 每个路由将 URL 模式映射到对应的 mock 处理函数
 */

import { registerMockRoute, mockSuccess, mockError } from './mock-adapter';
import type { RequestOptions, PaginationParams, ChatMessageItem } from '@/types/api';

// ============================================
// 导入 Mock 数据服务
// ============================================
import { 
  mockGetReviewsByDish, 
  mockCreateReview, 
  mockGetCommentsByReview, 
  mockCreateComment,
  mockDeleteReview,
  mockDeleteComment
} from './services/review';
import { mockGetDishById, mockGetDishes, mockGetDishesImages } from './services/dish';
import { mockGetCanteenList, mockGetCanteenDetail, mockGetWindowList, mockGetWindowDetail, mockGetWindowDishes, mockSearchDishes } from './services/canteen';
import { mockGetNewsList, mockGetNewsById } from './services/news';
import { 
  mockGetMealPlans, 
  mockCreateMealPlan,
  mockUpdateMealPlan,
  mockDeleteMealPlan,
  mockExecutePlan,
} from './services/meal-plan';
import { 
  mockWechatLogin, 
  mockRefreshToken,
  mockGetUserProfile, 
  mockUpdateUserProfile,
  mockGetMyReviews,
  mockGetMyFavorites,
  mockGetBrowseHistory,
  mockAddFavorite,
  mockRemoveFavorite,
} from './services/user';
import { 
  mockGetAISuggestions,
  mockCreateAISession,
  mockGetAIHistory
} from './services/ai';


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
  const review = await mockCreateReview({
    dishId: reviewData.dishId,
    rating: reviewData.rating,
    content: reviewData.content || '',
    images: reviewData.images,
  });
  
  return mockSuccess(review);
});

// DELETE /reviews/:id - 删除评价
registerMockRoute('DELETE', '/reviews/:id', async (url) => {
  const match = url.match(/\/reviews\/([^/]+)$/);
  const reviewId = match?.[1] || '';
  
  await mockDeleteReview(reviewId);
  return mockSuccess(null);
});

// ============================================
// Comment 相关路由
// ============================================

// GET /comments/:reviewId - 获取评价的评论列表
registerMockRoute('GET', '/comments/:reviewId', async (url, options) => {
  const match = url.match(/\/comments\/([^/]+)$/);
  const reviewId = match?.[1] || '';
  const params = options.data as PaginationParams;
  
  const data = await mockGetCommentsByReview(reviewId, params);
  return mockSuccess({
    items: data.items,
    meta: {
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      totalPages: Math.ceil(data.total / data.pageSize),
    },
  });
});

// POST /comments - 创建评论
registerMockRoute('POST', '/comments', async (url, options) => {
  const commentData = options.data as any;
  const comment = await mockCreateComment({
    reviewId: commentData.reviewId,
    content: commentData.content,
    parentCommentId: commentData.parentCommentId,
  });
  
  return mockSuccess(comment);
});

// DELETE /comments/:id - 删除评论
registerMockRoute('DELETE', '/comments/:id', async (url) => {
  const match = url.match(/\/comments\/([^/]+)$/);
  const commentId = match?.[1] || '';
  
  await mockDeleteComment(commentId);
  return mockSuccess(null);
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

// GET /dishes/images - 获取菜品图片列表
registerMockRoute('GET', '/dishes/images', async () => {
  const data = await mockGetDishesImages();
  return mockSuccess(data);
});

// POST /dishes/:dishId/favorite - 收藏菜品
registerMockRoute('POST', '/dishes/:dishId/favorite', async (url) => {
  const match = url.match(/\/dishes\/([^/]+)\/favorite/);
  const dishId = match?.[1] || '';
  
  await mockAddFavorite(dishId);
  return mockSuccess(null);
});

// DELETE /dishes/:dishId/favorite - 取消收藏菜品
registerMockRoute('DELETE', '/dishes/:dishId/favorite', async (url) => {
  const match = url.match(/\/dishes\/([^/]+)\/favorite/);
  const dishId = match?.[1] || '';
  
  await mockRemoveFavorite(dishId);
  return mockSuccess(null);
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

// POST /meal-plans - 创建用餐计划
registerMockRoute('POST', '/meal-plans', async (url, options) => {
  const planData = options.data as any;
  const data = await mockCreateMealPlan(planData);
  return mockSuccess(data);
});

// PATCH /meal-plans/:id - 更新用餐计划
registerMockRoute('PATCH', '/meal-plans/:id', async (url, options) => {
  const match = url.match(/\/meal-plans\/([^/]+)$/);
  const planId = match?.[1] || '';
  const planData = options.data as any;
  
  const data = await mockUpdateMealPlan(planId, planData);
  if (data) {
    return mockSuccess(data);
  } else {
    return { code: 404, message: '规划不存在', data: null };
  }
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

// POST /auth/refresh - 刷新 Token
registerMockRoute('POST', '/auth/refresh', async () => {
  const data = await mockRefreshToken();
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

// ============================================
// AI 相关路由
// ============================================

// GET /ai/suggestions - 获取AI提示词
registerMockRoute('GET', '/ai/suggestions', async (url, options) => {
  // mockGetAISuggestions 已经返回了完整的 ApiResponse，不需要再用 mockSuccess 包裹
  return await mockGetAISuggestions();
});

// POST /ai/sessions - 创建会话
registerMockRoute('POST', '/ai/sessions', async () => {
  return await mockCreateAISession();
});

// GET /ai/sessions/:sessionId/history - 获取历史记录
registerMockRoute('GET', '/ai/sessions/:sessionId/history', async (url) => {
  const match = url.match(/\/ai\/sessions\/([^/]+)\/history/);
  const sessionId = match?.[1] || '';
  return await mockGetAIHistory(sessionId);
});



// POST /ai/sessions/:sessionId/chat/stream - 模拟流式对话（降级实现）
// 由于原生流式请求可能直接用 uni.request，且不一定通过统一 request 拦截器，本路由提供一个简化的替代：
// - 接收请求体中的 message 字段，将用户消息记录到会话历史
// - 在短延迟后追加一条完整的 AI 回复到会话历史，供后续 /history 查询使用
registerMockRoute('POST', '/ai/sessions/:sessionId/chat/stream', async (url, options) => {
  try {
    const match = url.match(/\/ai\/sessions\/([^/]+)\/chat\/stream/);
    const sessionId = match?.[1] || '';
    const body = options?.data ? (typeof options.data === 'string' ? JSON.parse(options.data) : options.data) : {};
    const messageText = body?.message || '';

    // 将用户消息写入会话历史
    const historyRes = await mockGetAIHistory(sessionId);
    const history = historyRes.data?.messages || [];

    const userMsg: ChatMessageItem = {
      role: 'user',
      timestamp: new Date().toISOString(),
      content: [{ type: 'text', data: messageText }]
    };
    history.push(userMsg);

    // 异步在短时间后加入完整 AI 回复（模拟流结束后的汇总消息）
    setTimeout(() => {
      const aiMsg: ChatMessageItem = {
        role: 'assistant',
        timestamp: new Date().toISOString(),
        content: [{ type: 'text', data: `模拟回复：我收到了你的消息“${messageText}”，这是完整的回复。` }]
      };
      history.push(aiMsg);
    }, 300);

    return mockSuccess(null, 'stream started');
  } catch (err) {
    console.error('[Mock] stream route error', err);
    return mockError(500, 'stream mock failed');
  }
});

console.log('[Mock] 路由注册完成');
