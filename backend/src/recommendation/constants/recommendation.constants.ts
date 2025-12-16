/**
 * 推荐算法权重配置
 * 后续可通过配置中心或 A/B 测试框架动态调整
 */
export const RECOMMENDATION_WEIGHTS = {
  /** 用户偏好匹配权重 */
  PREFERENCE_MATCH: 25,
  /** 收藏相似度权重 */
  FAVORITE_SIMILARITY: 20,
  /** 浏览历史相关性权重 */
  BROWSE_RELEVANCE: 12,
  /** 菜品质量权重 */
  DISH_QUALITY: 18,
  /** 多样性权重 */
  DIVERSITY: 10,
  /** 搜索关键词匹配权重 */
  SEARCH_RELEVANCE: 15,
} as const;

/**
 * 搜索场景的权重配置（搜索关键词匹配更重要）
 */
export const SEARCH_SCENE_WEIGHTS = {
  /** 用户偏好匹配权重 */
  PREFERENCE_MATCH: 15,
  /** 收藏相似度权重 */
  FAVORITE_SIMILARITY: 12,
  /** 浏览历史相关性权重 */
  BROWSE_RELEVANCE: 8,
  /** 菜品质量权重 */
  DISH_QUALITY: 15,
  /** 多样性权重 */
  DIVERSITY: 5,
  /** 搜索关键词匹配权重 */
  SEARCH_RELEVANCE: 45,
} as const;

/**
 * 推荐候选集配置
 */
export const RECOMMENDATION_LIMITS = {
  /** 候选菜品最小数量 */
  MIN_CANDIDATES: 100,
  /** 候选菜品倍数（相对于请求数量） */
  CANDIDATE_MULTIPLIER: 5,
  /** 收藏历史最大获取数量 */
  MAX_FAVORITES: 50,
  /** 浏览历史最大获取数量 */
  MAX_BROWSE_HISTORY: 100,
  /** 最近浏览记录数量（用于多样性计算） */
  RECENT_BROWSE_COUNT: 20,
} as const;

/**
 * 推荐场景类型
 */
export enum RecommendationScene {
  /** 首页推荐 */
  HOME = 'home',
  /** 搜索推荐 */
  SEARCH = 'search',
  /** 相似推荐 */
  SIMILAR = 'similar',
  /** 猜你喜欢 */
  GUESS_LIKE = 'guess_like',
  /** 今日推荐 */
  TODAY = 'today',
}

/**
 * 推荐日志事件类型
 */
export enum RecommendationEventType {
  /** 曝光 */
  IMPRESSION = 'impression',
  /** 点击 */
  CLICK = 'click',
  /** 收藏 */
  FAVORITE = 'favorite',
  /** 评价 */
  REVIEW = 'review',
  /** 负反馈 */
  DISLIKE = 'dislike',
}

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
  /** 用户特征缓存 TTL（秒） */
  USER_FEATURE_TTL: 3600, // 1小时
  /** 菜品嵌入缓存 TTL（秒） */
  DISH_EMBEDDING_TTL: 1800, // 30分钟
  /** 用户嵌入缓存 TTL（秒） */
  USER_EMBEDDING_TTL: 3600, // 1小时
  /** 推荐结果缓存 TTL（秒） */
  RECOMMENDATION_RESULT_TTL: 300, // 5分钟
  /** 缓存键前缀 */
  KEY_PREFIX: {
    USER_FEATURE: 'rec:user:feature:',
    DISH_FEATURE: 'rec:dish:feature:',
    RECOMMENDATION: 'rec:result:',
    EXPERIMENT_USER_GROUP: 'rec:experiment:user_group:',
    EXPERIMENT_WEIGHTS: 'rec:experiment:weights:',
    STATS_EVENT: 'rec:stats:',
  },
} as const;
