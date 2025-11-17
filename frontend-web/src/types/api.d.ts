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
  floor?: string
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
  floor?: string
  windowNumber: string
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
  floor?: string
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
  status?: 'online' | 'offline'
  keyword?: string
}

// ==================== 食堂相关类型 ====================

/**
 * 窗口信息
 */
export interface Window {
  id: string
  name: string
  number: string
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
  operatingHours?: string
  averageRating?: number
  reviewCount?: number
  windowsList?: Window[]
}

/**
 * 营业时间
 */
export interface OpeningHours {
  day: string
  open: string
  close: string
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
}

/**
 * 更新食堂请求
 */
export interface CanteenUpdateRequest {
  name?: string
  position?: string
  description?: string
  images?: string[]
  openingHours?: OpeningHours[]
}

/**
 * 创建窗口请求
 */
export interface WindowCreateRequest {
  name: string
  number: string
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
  role: string
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
  reporterNickname: string
  targetType: 'review' | 'comment'
  targetId: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

/**
 * 处理举报请求
 */
export interface ReportHandleRequest {
  action: 'approve' | 'reject'
  reason?: string
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
  author: string
  images?: string[]
  status: 'draft' | 'published'
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * 创建新闻请求
 */
export interface NewsCreateRequest {
  title: string
  content: string
  author: string
  images?: string[]
  status?: 'draft' | 'published'
}

/**
 * 更新新闻请求
 */
export interface NewsUpdateRequest {
  title?: string
  content?: string
  author?: string
  images?: string[]
  status?: 'draft' | 'published'
}

/**
 * 获取新闻列表参数
 */
export interface GetNewsParams extends PaginationParams {
  status?: 'draft' | 'published'
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
