// Mock 服务统一入口

// Mock 配置
export const USE_MOCK = true; // 全局 Mock 开关

// User Service
export { 
  mockWechatLogin, 
  mockGetUserProfile, 
  mockUpdateUserProfile, 
  mockGetMyReviews, 
  mockGetMyFavorites, 
  mockGetBrowseHistory, 
  mockClearBrowseHistory 
} from './services/user';

// Dish Service
export { mockGetDishById } from './services/dish';

// News Service
export { mockGetNewsList, mockGetNewsById } from './services/news';

// Meal Plan Service
export { 
  mockGetMealPlans, 
  mockGetMealPlanById,
  mockCreateMealPlan,
  mockUpdateMealPlan,
  mockCreateOrUpdateMealPlan,
  mockDeleteMealPlan,
  mockGetCurrentPlans,
  mockGetHistoryPlans,
  mockGetPlansByMealTime,
  mockGetPlansByDateRange,
  mockResetMealPlans,
  mockExecutePlan,
} from './services/meal-plan';

// Canteen Service
export {
  mockGetCanteenList,
  mockGetCanteenDetail,
  mockGetWindowList,
  mockGetWindowDetail,
  mockGetWindowDishes,
  mockSearchDishes,
  mockGetDishesByTag,
  mockGetDishesByMealTime,
  mockGetRecommendedDishes,
  mockGetPopularDishes,
} from './services/canteen';

// 导出 Mock 数据（用于测试）
export { createMockMealPlans, getMockPlanDatabase, resetMockPlanDatabase } from './data/meal-plan';
export { createMockDishes, getDishesByWindowId } from './data/dish';
export { createMockCanteens, createMockWindows, getWindowsByCanteenId } from './data/canteen';
