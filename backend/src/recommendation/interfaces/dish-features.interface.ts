/**
 * 菜品特征（用于推荐计算）
 */
export interface DishFeatures {
  id: string;
  name: string;
  tags: string[];
  price: number;
  canteenId: string;
  ingredients: string[];
  allergens: string[];
  spicyLevel: number;
  sweetness: number;
  saltiness: number;
  oiliness: number;
  averageRating: number;
  reviewCount: number;
}

/**
 * 带分数的菜品
 */
export interface ScoredDish<T = any> {
  dish: T;
  score: number;
  /** 分数明细（用于调试和分析） */
  scoreBreakdown?: ScoreBreakdown;
}

/**
 * 分数明细
 */
export interface ScoreBreakdown {
  preferenceScore: number; // 来自用户偏好的匹配分数
  favoriteScore: number; // 来自收藏特征的相似度分数
  browseScore: number; // 来自浏览历史的相关性分数
  qualityScore: number; // 菜品质量分数（评分和评论数）
  diversityScore: number; // 多样性分数
  searchScore: number; // 搜索关键词匹配分数
}
