/**
 * API 类型定义
 * 根据 TasteInsight API 文档生成
 */

// ==================== 通用类型 ====================

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * 分页响应
 */
export interface PaginationResponse<T> {
  items: T[]
  meta: PaginationMeta
}

/**
 * 统一响应格式
 */
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  code: number
  message: string
}

/**
 * 成功响应
 */
export interface SuccessResponse {
  code: number
  message: string
}

// ==================== 认证相关类型 ====================

/**
 * 登录凭证
 */
export interface LoginCredentials {
  username: string
  password: string
}

/**
 * Token 信息
 */
export interface TokenInfo {
  accessToken: string
  refreshToken: string
}

/**
 * 管理员登录响应
 */
export interface AdminLoginResponse {
  token: TokenInfo
  admin: Admin
  permissions: string[]
}

/**
 * 普通用户登录响应
 */
export interface LoginResponse {
  token: TokenInfo
  user: User
}

// ==================== 用户相关类型 ====================

/**
 * 用户信息
 */
export interface User {
  id: string
  openId: string
  nickname: string
  avatar: string
  allergens?: string[]
  myFavoriteDishes?: string[]
  myReviews?: string[]
  myRatings?: string[]
  myComments?: string[]
  createdAt: string
  updatedAt: string
}

// ==================== 菜品相关类型 ====================

/**
 * 可用日期
 */
export interface AvailableDate {
  startDate: string
  endDate: string
}

/**
 * 菜品信息
 */
export interface Dish {
  id: string
  name: string
  tags?: string[]
  price: number
  description?: string
  images?: string[]
  parentDishId?: string
  subDishId?: string[]
  ingredients?: string[]
  allergens?: string[]
  spicyLevel?: number
  sweetness?: number
  saltiness?: number
  oiliness?: number
  canteenId: string
  canteenName: string
  floorId?: string | null
  floorLevel?: string | null
  floorName?: string | null
  windowId?: string | null
  windowNumber: string
  windowName: string
  availableMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'nightsnack')[]
  availableDates?: AvailableDate[]
  status: 'online' | 'offline'
  averageRating?: number
  reviewCount?: number
  createdAt: string
  updatedAt: string
}

/**
 * 创建菜品请求
 */
export interface DishCreateRequest {
  name: string
  tags?: string[]
  price: number
  description?: string
  images?: string[]
  parentDishId?: string
  subDishId?: string[]
  ingredients?: string[]
  allergens?: string[]
  spicyLevel?: number
  sweetness?: number
  saltiness?: number
  oiliness?: number
  canteenId?: string
  canteenName: string
  windowNumber?: string
  windowName: string
  availableMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'nightsnack')[]
  availableDates?: AvailableDate[]
  status?: 'online' | 'offline'
}

/**
 * 更新菜品请求
 */
export interface DishUpdateRequest {
  name?: string
  tags?: string[]
  price?: number
  description?: string
  images?: string[]
  parentDishId?: string
  subDishId?: string[]
  ingredients?: string[]
  allergens?: string[]
  spicyLevel?: number
  sweetness?: number
  saltiness?: number
  oiliness?: number
  canteenId?: string
  canteenName?: string
  windowNumber?: string
  windowName?: string
  availableMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'nightsnack')[]
  availableDates?: AvailableDate[]
  status?: 'online' | 'offline'
}

/**
 * 获取菜品列表参数
 */
export interface GetDishesParams extends PaginationParams {
  canteenId?: string
  windowId?: string
  status?: 'online' | 'offline'
  keyword?: string
}


// ==================== 批量导入相关类型 ====================

/**
 * 批量解析后的单条菜品数据（用于预览和确认）
 */
export interface BatchParsedDish {
  // 基础信息
  tempId: string          // 前端生成的临时ID，用于列表渲染
  name: string            // 菜品名
  description?: string    // 菜品描述
  price: number           // 价格（数字部分）
  priceUnit?: string      // 价格单位（如"元"、"元/份"、"元/两"、"元/斤"）
  tags?: string[]         // tags
  ingredients?: string[]  // 主辅料
  allergens?: string[]    // 过敏原
  
  // 位置信息
  canteenName: string     // 食堂
  floorName?: string      // 楼层
  windowName: string      // 窗口
  windowNumber?: string   // 窗口编号
  
  // 供应信息
  supplyTime?: string     // 供应时间 (对应 Excel 原始文本，如 "2023-01-01 至 2023-12-31")
  supplyPeriod?: string[] // 供应时段 (如 ["早餐", "午餐"])
  
  // 子项信息
  subDishNames?: string[] // 菜品子项名 (用于后端查找或创建子菜品)
  
  // 解析状态
  status: 'valid' | 'invalid' | 'warning'
  message?: string        // 错误或警告信息 (如 "窗口不存在，将自动创建")
  
  // 原始数据 (可选，用于调试或回显)
  rawData?: any
}

/**
 * 批量解析响应
 */
export interface BatchParseResponse {
  items: BatchParsedDish[]
  total: number
  validCount: number
  invalidCount: number
}

/**
 * 批量确认导入请求
 */
export interface BatchConfirmRequest {
  dishes: BatchParsedDish[] // 仅提交状态为 valid 或 warning 的数据
}

/**
 * 批量确认响应
 */
export interface BatchConfirmResponse {
  successCount: number
  failCount: number
  errors?: Array<{ index: number; message: string; type?: 'validation' | 'permission' | 'unknown' }>
}

// ==================== 食堂相关类型 ====================

/**
 * 楼层信息
 */
export interface Floor {
  level: string
  name?: string
}

/**
 * 窗口信息
 */
export interface Window {
  id: string
  name: string
  number: string
  floor?: Floor
  position?: string
  description?: string
  tag?: string[]
}

/**
 * 食堂信息
 */
export interface Canteen {
  id: string
  name: string
  position?: string
  description?: string
  images?: string[]
  openingHours?: OpeningHours[]
  averageRating?: number
  reviewCount?: number
  floors: Floor[]
  windows?: Window[]
}

/**
 * 营业时间槽
 */
export interface TimeSlot {
  mealType?: string
  openTime: string
  closeTime: string
}

/**
 * 营业时间
 */
export interface DaliyOpeningHours {
  dayOfWeek: string
  slots: TimeSlot[]
  isClosed: boolean
}

export class FloorOpeningHours {
  floorLevel: string; // 如“1”，"2"。如果为"default"或空，则为通用配置
schedule: DailyopeningHours[];
}

/**
 * 创建食堂请求
 */
export interface CanteenCreateRequest {
  name: string
  position?: string
  description?: string
  images?: string[]
  openingHours?: OpeningHours[]
  floors: Floor[]
}

/**
 * 更新食堂请求
 */
export interface CanteenUpdateRequest {
  name?: string
  position?: string
  description?: string
  images?: string[]
  openingHours?: FloorOpeningHours[]
  floors?: Floor[]
}

/**
 * 创建窗口请求
 */
export interface WindowCreateRequest {
  name: string
  number?: string
  floor?: Floor
  canteenId: string
  position?: string
  description?: string
  tags?: string[]
}

/**
 * 更新窗口请求
 */
export interface WindowUpdateRequest {
  name?: string
  number?: string
  floor?: Floor
  position?: string
  description?: string
  tags?: string[]
}

// ==================== 管理员相关类型 ====================

/**
 * 管理员信息
 */
export interface Admin {
  id: string
  username: string
  role: string
  canteenId?: string | null
  canteenName?: string | null
  createdBy?: string | null
  createdAt: string
}

/**
 * 管理员详细信息（含权限）
 */
export interface AdminWithPermissions extends Admin {
  permissions: string[]
}

/**
 * 创建管理员请求
 */
export interface CreateAdminRequest {
  username: string
  password: string
  role?: string // 角色为可选字段，可以是预设角色或自定义角色
  canteenId?: string
  permissions?: string[]
}

/**
 * 更新管理员权限请求
 */
export interface UpdateAdminPermissionsRequest {
  permissions: string[]
}

/**
 * 获取管理员列表参数
 */
export interface GetAdminsParams extends PaginationParams {
  role?: string
  canteenId?: string
}

// ==================== 审核相关类型 ====================

/**
 * 评价信息
 */
export interface Review {
  id: string
  dishId: string
  userId: string
  userNickname: string
  userAvatar: string
  rating: number
  content: string
  images?: string[]
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

/**
 * 待审核评价（包含菜品信息）
 */
export interface PendingReview extends Review {
  dishName: string
  dishImage?: string
}

/**
 * 评分统计详情
 */
export interface RatingDetail {
  [rating: string]: number
}

/**
 * 评分统计信息
 */
export interface RatingStatistics {
  average: number
  total: number
  detail: RatingDetail
}

/**
 * 菜品评价列表响应数据
 */
export interface DishReviewsData {
  items: Review[]
  meta: PaginationMeta
  rating: RatingStatistics
}

/**
 * 获取菜品评价列表参数
 */
export interface GetDishReviewsParams extends PaginationParams {
  status?: 'pending' | 'approved' | 'rejected'
}

/**
 * 父评论信息（用于回复）
 */
export interface ParentComment {
  id: string
  userId: string
  userNickname: string
  deleted: boolean
}

/**
 * 评论信息
 */
export interface Comment {
  id: string
  reviewId: string
  userId: string
  userNickname: string
  userAvatar: string
  content: string
  status: 'pending' | 'approved' | 'rejected'
  parentComment?: ParentComment | null
  floor: number
  createdAt: string
}

/**
 * 待审核评论（包含关联信息）
 */
export interface PendingComment extends Comment {
  reviewContent: string
  dishName: string
}

/**
 * 举报信息
 */
export interface Report {
  id: string
  reporterId: string
  reporterNickname?: string 
  targetType: 'review' | 'comment'
  targetId: string
  type: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  handleResult: string | null
  handledBy: string | null
  handledAt: string | null
  createdAt: string
  updatedAt?: string 
  reporter?: {
    id: string
    nickname: string
    avatar: string | null
  }
  targetContent?: {
    content: string | null
    userId: string
    userNickname: string
    isDeleted: boolean
    images?: string[] // 评价图片（仅当targetType为review时存在）
  }
}

/**
 * 处理举报请求
 */
export interface ReportHandleRequest {
  action: 'delete_content' | 'warn_user' | 'reject_report'
  result?: string
}

/**
 * 获取待审核列表参数
 */
export interface GetPendingParams extends PaginationParams {
  status?: 'pending' | 'approved' | 'rejected'
}

// ==================== 新闻相关类型 ====================

/**
 * 新闻信息
 */
export interface News {
  id: string
  title: string
  content: string
  summary?: string
  canteenId?: string
  canteenName?: string
  author?: string // 兼容旧代码，对应 createdBy
  createdBy?: string
  images?: string[]
  status?: 'draft' | 'published'
  publishedAt?: string
  createdAt: string
  updatedAt?: string
}

/**
 * 创建新闻请求
 */
export interface NewsCreateRequest {
  title: string
  content: string
  summary?: string
  canteenId?: string
  author?: string // 暂时保留
  images?: string[]
  status?: 'draft' | 'published'
}

/**
 * 更新新闻请求
 */
export interface NewsUpdateRequest {
  title?: string
  content?: string
  summary?: string
  canteenId?: string
  author?: string // 暂时保留
  images?: string[]
  status?: 'draft' | 'published'
}

/**
 * 获取新闻列表参数
 */
export interface GetNewsParams extends PaginationParams {
  status?: 'draft' | 'published'
  canteenName?: string
}

// ==================== 日志相关类型 ====================

/**
 * 操作日志
 */
export interface OperationLog {
  id: string
  adminId: string
  adminName: string
  action: string
  resource: string
  resourceId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

/**
 * 日志查询参数
 */
export interface LogQueryParams extends PaginationParams {
  adminId?: string
  action?: string
  startDate?: string
  endDate?: string
}

/**
 * 获取日志列表参数（别名）
 */
export type GetLogsParams = LogQueryParams

// ==================== 图片上传相关类型 ====================

/**
 * 图片上传响应
 */
export interface ImageUploadResponse {
  url: string
  filename: string
}

// ==================== 兼容旧代码的类型别名 ====================

/**
 * @deprecated 使用 DishCreateRequest 替代
 */
export type CreateDishData = DishCreateRequest

/**
 * @deprecated 使用 DishUpdateRequest 替代
 */
export type UpdateDishData = DishUpdateRequest

/**
 * @deprecated 使用 CreateAdminRequest 替代
 */
export type CreateAdminData = CreateAdminRequest

/**
 * @deprecated 使用 UpdateAdminPermissionsRequest 替代
 */
export type UpdateAdminPermissionsData = UpdateAdminPermissionsRequest

// ==================== 配置管理相关类型 ====================

/**
 * 配置模板
 */
export interface ConfigTemplate {
  id: string
  key: string
  defaultValue: string
  valueType: 'boolean' | 'string' | 'number'
  description: string | null
  category: string
  createdAt: string
  updatedAt: string
}

/**
 * 配置项
 */
export interface ConfigItem {
  id: string
  adminConfigId: string
  templateId: string | null
  key: string
  value: string
  valueType: 'boolean' | 'string' | 'number'
  description: string | null
  category: string
  createdAt: string
  updatedAt: string
}

/**
 * 管理员配置
 */
export interface AdminConfig {
  id: string
  canteenId: string | null
  items: ConfigItem[]
  createdAt: string
  updatedAt: string
}

/**
 * 有效配置值
 */
export interface EffectiveConfigValue {
  key: string
  value: string
  valueType: 'boolean' | 'string' | 'number'
  source: 'canteen' | 'global' | 'default'
}

/**
 * 更新配置请求
 */
export interface UpdateConfigRequest {
  key: string
  value: string
}

/**
 * 获取配置模板列表响应
 */
export interface ConfigTemplatesResponse {
  items: ConfigTemplate[]
  meta: PaginationMeta
}

/**
 * 获取全局配置响应
 */
export interface GlobalConfigResponse {
  config: AdminConfig
  templates: ConfigTemplate[]
}

/**
 * 获取食堂配置响应
 */
export interface CanteenConfigResponse {
  config: AdminConfig
  globalConfig: AdminConfig
  templates: ConfigTemplate[]
}

/**
 * 获取食堂有效配置响应
 */
export interface EffectiveConfigResponse {
  items: EffectiveConfigValue[]
}

// ==================== 推荐系统相关类型 ====================

/**
 * 推荐场景
 */
export type RecommendScene = 'home' | 'search' | 'similar' | 'guess_like' | 'today'

/**
 * 用餐时间
 */
export type MealTime = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'

/**
 * 评分范围
 */
export interface RatingRange {
  min?: number
  max?: number
}

/**
 * 价格范围
 */
export interface PriceRange {
  min?: number
  max?: number
}

/**
 * 口味范围
 */
export interface FlavorRange {
  min?: number
  max?: number
}

/**
 * 过滤条件
 */
export interface RecommendFilter {
  rating?: RatingRange
  mealTime?: MealTime[]
  price?: PriceRange
  tag?: string[]
  includeOffline?: boolean
  canteenId?: string[]
  meatPreference?: string[]
  avoidIngredients?: string[]
  favoriteIngredients?: string[]
  spicyLevel?: FlavorRange
  sweetness?: FlavorRange
  saltiness?: FlavorRange
  oiliness?: FlavorRange
}

/**
 * 搜索条件
 */
export interface RecommendSearch {
  keyword?: string
  fields?: string[]
}

/**
 * 分页参数（推荐系统专用）
 */
export interface RecommendPagination {
  page: number
  pageSize: number
}

/**
 * 用户上下文信息
 */
export interface UserContext {
  [key: string]: number | string | boolean
}

/**
 * 获取个性化推荐请求参数
 */
export interface GetRecommendRequest {
  scene?: RecommendScene
  requestId?: string
  experimentId?: string
  triggerDishId?: string
  filter: RecommendFilter
  search?: RecommendSearch
  pagination: RecommendPagination
  includeScoreBreakdown?: boolean
  userContext?: UserContext
}

/**
 * 分数明细
 */
export interface ScoreBreakdown {
  preferenceMatch?: number
  favoriteSimilarity?: number
  browseRelevance?: number
  dishQuality?: number
  diversity?: number
  searchRelevance?: number
}

/**
 * 推荐菜品项（完整版，包含分数明细）
 */
export interface RecommendedDishItem {
  id: string
  score?: number
  scoreBreakdown?: ScoreBreakdown
  [key: string]: any
}

/**
 * 推荐菜品项（简化版）
 */
export interface RecommendItem {
  id: string
  score?: number
  [key: string]: any
}

/**
 * 调试信息
 */
export interface DebugInfo {
  processingTimeMs?: number
  candidateCount?: number
  scene?: string
  hasSearch?: boolean
  weightsUsed?: Record<string, number>
}

/**
 * 获取个性化推荐响应数据（/recommend）
 */
export interface GetRecommendResponseData {
  items: RecommendedDishItem[]
  meta: PaginationMeta
  requestId?: string
  groupItemId?: string
  debug?: DebugInfo
}

/**
 * 获取相似/个性化推荐响应数据（/recommend/similar/{dishId} 和 /recommend/personal）
 */
export interface SimilarRecommendResponseData {
  items: RecommendItem[]
  total: number
  pagination: {
    page: number
    pageSize: number
    totalPages: number
  }
}

/**
 * 获取相似菜品推荐请求参数
 */
export interface GetSimilarRecommendRequest {
  pagination: RecommendPagination
}

/**
 * 获取基于嵌入的个性化推荐请求参数
 */
export interface GetPersonalRecommendRequest {
  canteenId?: string
  mealTime?: string
  pagination: RecommendPagination
}

/**
 * 推荐事件基础参数
 */
export interface RecommendEventBase {
  dishId: string
  requestId?: string
  position?: number
  scene?: RecommendScene
  experimentId?: string
  groupItemId?: string
}

/**
 * 点击事件请求参数
 */
export interface ClickEventRequest extends RecommendEventBase {}

/**
 * 收藏事件请求参数
 */
export interface FavoriteEventRequest extends RecommendEventBase {}

/**
 * 评价事件请求参数
 */
export interface ReviewEventRequest extends RecommendEventBase {
  rating: number
}

/**
 * 负反馈事件请求参数
 */
export interface DislikeEventRequest extends RecommendEventBase {
  reason?: string
}

/**
 * 事件记录响应数据
 */
export interface EventResponseData {
  eventId: string
}

/**
 * 推荐事件类型
 */
export type RecommendEventType =
  | 'impression'
  | 'click'
  | 'favorite'
  | 'review'
  | 'dislike'
  | string

/**
 * 推荐事件项
 */
export interface RecommendEventItem {
  eventId: string
  eventType: RecommendEventType
  dishId: string
  position?: number
  timestamp: string
}

/**
 * 获取推荐请求事件链响应数据
 */
export interface EventChainResponseData {
  requestId: string
  events: RecommendEventItem[]
  eventCount: number
}

/**
 * 获取用户行为漏斗数据请求参数
 */
export interface GetFunnelAnalyticsParams {
  days?: number
}

/**
 * 用户行为漏斗数据响应
 */
export interface FunnelAnalyticsResponseData {
  [key: string]: any
}

/**
 * 实验分组信息响应数据
 */
export interface ExperimentGroupResponseData {
  [key: string]: any
}

/**
 * 推荐系统健康状态响应数据
 */
export interface RecommendHealthResponseData {
  [key: string]: any
}
