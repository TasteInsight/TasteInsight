// Mock 服务统一入口
// 新架构：通过 mock-adapter 和 mock-routes 实现请求拦截
// API 文件不再需要导入这些，直接通过 request 层自动拦截

// 重新导出 Mock 配置（供需要检查 mock 状态的地方使用）
export { USE_MOCK } from './mock-adapter';

// 导出 Mock 数据（仅用于测试或特殊场景）
export { createMockMealPlans, getMockPlanDatabase, resetMockPlanDatabase } from './data/meal-plan';
export { createMockDishes, getDishesByWindowId } from './data/dish';
export { createMockCanteens, createMockWindows, getWindowsByCanteenId } from './data/canteen';
export { 
  createMockReviews, 
  createMockComments, 
  getReviewsByDishId, 
  getCommentsByReviewId,
  getRatingDetailByDishId,
} from './data/review';

