/**
 * 菜品状态枚举
 */
export enum DishStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

/**
 * 供应时间枚举
 */
export enum MealTime {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  NIGHTSNACK = 'nightsnack',
}

/**
 * 菜品可排序字段枚举
 */
export enum DishSortField {
  PRICE = 'price',
  AVERAGE_RATING = 'averageRating',
  REVIEW_COUNT = 'reviewCount',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

/**
 * 举报类型枚举
 */
export enum ReportType {
  INAPPROPRIATE = 'inappropriate',
  SPAM = 'spam',
  FALSE_INFO = 'false_info',
  OTHER = 'other',
}
