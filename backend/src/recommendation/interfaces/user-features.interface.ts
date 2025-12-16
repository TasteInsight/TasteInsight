/**
 * 用户特征接口
 * 用于推荐计算的用户画像数据
 */
export interface UserFeatures {
  userId: string;
  /** 用户偏好数据 */
  preferences: UserPreferenceFeatures | null;
  /** 收藏菜品特征 */
  favoriteFeatures: FavoriteFeatureSummary;
  /** 浏览历史特征 */
  browseFeatures: BrowseFeatureSummary;
  /** 用户过敏原 */
  allergens: string[];
}

/**
 * 用户偏好特征
 */
export interface UserPreferenceFeatures {
  tagPreferences: string[];
  priceMin: number;
  priceMax: number;
  meatPreference: string[];
  avoidIngredients: string[];
  favoriteIngredients: string[];
  spicyLevel: number;
  sweetness: number;
  saltiness: number;
  oiliness: number;
  canteenPreferences: string[];
}

/**
 * 收藏特征摘要
 */
export interface FavoriteFeatureSummary {
  /** 常见标签及权重 */
  tagWeights: Map<string, number>;
  /** 常去食堂 */
  canteenIds: Set<string>;
  /** 常见食材 */
  ingredients: Set<string>;
  /** 平均口味偏好 */
  avgSpicyLevel: number;
  avgSweetness: number;
  avgSaltiness: number;
  avgOiliness: number;
  /** 平均价格 */
  avgPrice: number;
  /** 收藏的菜品 ID 集合 */
  dishIds: Set<string>;
}

/**
 * 浏览特征摘要
 */
export interface BrowseFeatureSummary {
  /** 标签权重（带时间衰减） */
  tagWeights: Map<string, number>;
  /** 食堂权重（带时间衰减） */
  canteenWeights: Map<string, number>;
  /** 最近浏览的菜品 ID */
  recentDishIds: Set<string>;
}
