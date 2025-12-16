import {
  RecommendationScene,
  RecommendationEventType,
} from '../constants/recommendation.constants';

/**
 * 推荐上下文
 */
export interface RecommendationContext {
  /** 用户 ID */
  userId: string;
  /** 推荐场景 */
  scene: RecommendationScene;
  /** 请求 ID（用于日志追踪） */
  requestId?: string;
  /** 触发菜品 ID（相似推荐场景） */
  triggerDishId?: string;
  /** 实验分组项 ID（A/B 测试） */
  groupItemId?: string;
}

/**
 * 搜索上下文，用于在评分时传递搜索信息
 */
export interface SearchContext {
  /** 原始搜索关键词 */
  keyword: string;
  /** 搜索字段 */
  fields: string[];
  /** 预处理的搜索关键词（小写、分词） */
  normalizedKeywords: string[];
}

/**
 * 推荐事件日志
 */
export interface RecommendationEvent {
  /** 事件 ID */
  eventId: string;
  /** 事件类型 */
  eventType: RecommendationEventType;
  /** 用户 ID */
  userId: string;
  /** 菜品 ID */
  dishId: string;
  /** 推荐场景 */
  scene: RecommendationScene;
  /** 推荐请求 ID */
  requestId?: string;
  /** 菜品在列表中的位置 */
  position?: number;
  /** 推荐分数 */
  score?: number;
  /** 实验 ID */
  experimentId?: string;
  /** 实验分组项 ID */
  groupItemId?: string;
  /** 额外数据 */
  extra?: Record<string, any>;
  /** 事件时间 */
  timestamp: Date;
}
