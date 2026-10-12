export const EMBEDDING_QUEUE = 'embedding-queue';

export enum EmbeddingJobType {
  /** 刷新指定食堂的所有菜品嵌入 */
  REFRESH_CANTEEN_DISHES = 'refresh-canteen-dishes',
  /** 刷新单个菜品嵌入 */
  REFRESH_DISH = 'refresh-dish-embedding',
  /** 刷新用户嵌入 */
  REFRESH_USER = 'refresh-user-embedding',
  /** 批量刷新菜品嵌入 */
  REFRESH_DISHES_BATCH = 'refresh-dishes-batch',
}

/** 刷新食堂菜品嵌入任务数据 */
export interface RefreshCanteenDishesJobData {
  canteenId: string;
}

/** 刷新单个菜品嵌入任务数据 */
export interface RefreshDishJobData {
  dishId: string;
}

/** 批量刷新菜品嵌入任务数据 */
export interface RefreshDishesBatchJobData {
  dishIds: string[];
}

/** 刷新用户嵌入任务数据 */
export interface RefreshUserJobData {
  userId: string;
}
