// Mock 服务统一入口
export * from './services/user';
export * from './services/dish';
export * from './services/news';
export * from './services/meal-plan';

// 导出具体的 Mock 函数
export { mockWechatLogin, mockGetUserProfile, mockUpdateUserProfile, mockGetMyReviews, mockGetMyFavorites, mockGetBrowseHistory, mockClearBrowseHistory } from './services/user';
export { mockGetDishById } from './services/dish';
export { mockGetNewsList, mockGetNewsById } from './services/news';
export { mockGetMealPlans } from './services/meal-plan';



// Mock 配置
export const USE_MOCK = false; // 全局 Mock 开关
