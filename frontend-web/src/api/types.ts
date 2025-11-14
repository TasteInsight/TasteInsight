/**
 * API 类型定义
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
 * 分页响应
 */
export interface PaginationResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
}

/**
 * 统一响应格式
 */
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// ==================== 认证相关类型 ====================

/**
 * 登录凭证
 */
export interface LoginCredentials {
  username: string
  password: string
  remember?: boolean
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string
  user: UserInfo
}

/**
 * 用户信息
 */
export interface UserInfo {
  id: string | number
  username: string
  name?: string
  email?: string
  role?: string
  [key: string]: any
}

// ==================== 菜品相关类型 ====================

/**
 * 菜品信息
 */
export interface Dish {
  id: string | number
  name: string
  canteen: string
  window?: string
  price?: string | number
  priceRange?: string
  status?: string
  rating?: number
  [key: string]: any
}

/**
 * 创建菜品数据
 */
export interface CreateDishData {
  name: string
  canteen: string
  window?: string
  price?: string | number
  priceRange?: string
  [key: string]: any
}

/**
 * 更新菜品数据
 */
export interface UpdateDishData extends Partial<CreateDishData> {
  id: string | number
}

// ==================== 管理员相关类型 ====================

/**
 * 管理员信息
 */
export interface Admin {
  id: string | number
  username: string
  name?: string
  email?: string
  role?: string
  status?: 'active' | 'inactive' | 'pending'
  canteenName?: string
  canteenId?: string
  permissions?: string[]
  lastLogin?: Date | string
  [key: string]: any
}

/**
 * 创建管理员数据
 */
export interface CreateAdminData {
  username: string
  password: string
  canteenId?: string
  permissions?: string[]
  name?: string
  email?: string
  phone?: string
  department?: string
}

/**
 * 更新管理员权限数据
 */
export interface UpdateAdminPermissionsData {
  permissions: string[]
}

/**
 * 获取管理员列表参数
 */
export interface GetAdminsParams extends PaginationParams {
  role?: string
  status?: string
  keyword?: string
}

