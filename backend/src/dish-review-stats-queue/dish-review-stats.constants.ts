// 队列名称常量
export const DISH_REVIEW_STATS_QUEUE = 'dish-review-stats';

// 任务类型
export enum DishReviewStatsJobType {
  RECOMPUTE_DISH_REVIEW_STATS = 'recompute-dish-review-stats',
}

// 任务数据接口
export interface RecomputeDishReviewStatsJobData {
  dishId: string;
}
