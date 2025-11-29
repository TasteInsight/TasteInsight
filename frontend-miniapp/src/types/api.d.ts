// @/types/api.d.ts

// ============================================
// 基础类型定义
// ============================================

/**
 * HTTP 请求方法
 */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * 分页元信息
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 通用 API 响应包装器
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * 成功响应包装器
 */
export interface SuccessResponse<T = any> {
  code: 200;
  message: string;
  data: null | T;
}


/**
 * 分页数据响应
 */
export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

// ============================================
// 数据模型 (Models)
// ============================================

/**
 * 用户信息模型
 */
export interface User {
  id: string;
  openId: string;
  nickname: string;
  avatar: string;
  preferences?: UserPreference;
  allergens?: string[];
  myFavoriteDishes?: string[];
  myReviews?: string[];
  myComments?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 用户偏好设置
 */
export interface UserPreference {
  id: string;
  userId: string;
  spicyLevel?: number; // 0-5
  tagPreferences?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  meatPreference?: string[]; // 修正为 meatPreferences
  tastePreferences?: {
    spiciness?: number; // 添加辣度字段
    sweetness?: number;
    saltiness?: number;
    oiliness?: number;
  };
  canteenPreferences?: string[];
  portionSize?: 'small' | 'medium' | 'large';
  avoidIngredients?: string[];
  favoriteIngredients?: string[];
  notificationSettings?: {
    newDishAlert?: boolean;
    priceChangeAlert?: boolean;
    reviewReplyAlert?: boolean;
    weeklyRecommendation?: boolean;
  };
  displaySettings?: {
    showCalories?: boolean;
    showNutrition?: boolean;
    sortBy?: 'rating' | 'price_low' | 'price_high' | 'popularity' | 'newest';
  };
}

/**
 * Floor
 */
export interface Floor {
    /**
     * 楼层数
     */
    level: string;
    /**
     * 楼层名
     */
    name?: string;
    [property: string]: any;
}

export interface OpeningHour {
    /**
     * 星期几
     */
    dayOfWeek: string;
    /**
     * 是否关闭
     */
    isClosed: boolean;
    /**
     * 当天的开放时段列表
     */
    slots: Slot[];
    [property: string]: any;
}

export interface Slot {
    /**
     * 结束时间
     */
    closeTime: string;
    /**
     * 早/中/晚/夜宵
     */
    mealType: string;
    /**
     * 开始时间
     */
    openTime: string;
    [property: string]: any;
}

/**
 * Window
 */
export interface Window {
    description?: string;
    floor: Floor;
    id: string;
    name: string;
    /**
     * 窗口号
     */
    number: string;
    position?: string;
    /**
     * 特色
     */
    tags?: string[];
    [property: string]: any;
}

/**
 * Canteen
 */
export interface Canteen {
    /**
     * 平均评分
     */
    averageRating?: number;
    description?: string;
    floors: Floor[];
    id: string;
    images: string[];
    name: string;
    /**
     * 营业时间
     */
    openingHours: OpeningHour[];
    position?: string;
    /**
     * 评论数
     */
    reviewCount?: number;
    /**
     * 窗口列表
     */
    windows: Window[];
    [property: string]: any;
}

export interface AvailableDate {
    endDate: Date;
    startDate: Date;
    [property: string]: any;
}

export enum AvailableMealTime {
    Breakfast = "breakfast",
    Dinner = "dinner",
    Lunch = "lunch",
    Nightsnack = "nightsnack",
}

/**
 * 菜品状态
 */
export enum Status {
    Offline = "offline",
    Online = "online",
}

/**
 * Dish
 */
export interface Dish {
    /**
     * 过敏原
     */
    allergens?: string[];
    availableDates?: AvailableDate[];
    /**
     * 供应时段
     */
    availableMealTime?: AvailableMealTime[];
    /**
     * 平均评分
     */
    averageRating: number;
    /**
     * 所属食堂ID
     */
    canteenId?: string;
    /**
     * 所属食堂名称
     */
    canteenName?: string;
    createdAt?: Date;
    /**
     * 菜品描述
     */
    description?: string;
    /**
     * 楼层
     */
    floorLevel?: string;
    /**
     * 楼层名
     */
    floorName?: string;
    id: string;
    /**
     * 图片URL列表
     */
    images: string[];
    /**
     * 原辅料
     */
    ingredients?: string[];
    /**
     * 菜品名称
     */
    name: string;
    oiliness?: number;
    /**
     * 父项菜ID
     */
    parentDishId?: string;
    /**
     * 价格
     */
    price: number;
    /**
     * 评价数量
     */
    reviewCount?: number;
    saltiness?: number;
    spicyLevel?: number;
    /**
     * 菜品状态
     */
    status?: Status;
    /**
     * 菜品子项列表
     */
    subDishId?: string[];
    sweetness?: number;
    /**
     * 菜品标签
     */
    tags?: string[];
    updatedAt?: Date;
    /**
     * 窗口名
     */
    windowName?: string;
    /**
     * 窗口号
     */
    windowNumber?: string;
    [property: string]: any;
}

/**
 * 评价模型
 */
export interface Review {
  id: string;
  dishId: string;
  userId: string;
  userNickname: string;
  userAvatar: string;
  rating: number;
  content: string;
  images: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/**
 * 评论模型
 */
export interface Comment {
  id: string;
  reviewId: string;
  userId: string;
  userNickname: string;
  userAvatar: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/**
 * 收藏模型
 */
export interface Favorite {
  dishId: string;
  addedAt: string;
}

/**
 * 举报模型
 */
export interface Report {
  id: string;
  reporterId: string;
  reporterNickname: string;
  targetType: 'review' | 'comment';
  targetId: string;
  type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  handleResult?: string | null;
  handledBy?: string | null;
  createdAt: string;
  handledAt?: string | null;
}

/**
 * 新闻模型
 */
export interface News {
  id: string;
  title: string;
  content: string;
  summary: string;
  canteenId: string;
  canteenName: string;
  publishedAt: string;
  createdBy: string;
  createdAt: string;
}

/**
 * 饮食计划模型
 */
export interface MealPlan {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  mealTime: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack';
  dishes: string[];
  createdAt: string;
}

/**
 * 管理员模型
 */
export interface Admin {
  id: string;
  username: string;
  role: string;
  canteenId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

/**
 * 操作日志模型
 */
export interface OperationLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  result: 'success' | 'failure';
  createdAt: string;
}

// ============================================
// API 请求参数类型
// ============================================

/**
 * 登录请求
 */
export interface LoginRequest {
  code: string;
}

/**
 * 管理员登录请求
 */
export interface AdminLoginRequest {
  username: string;
  password: string;
}

/**
 * 食堂列表响应数据
 */
export interface CanteenListData {
  items: Canteen[];
  meta: PaginationMeta;
}

/**
 * 窗口列表响应数据
 */
export interface WindowListData {
  items: Window[];
  meta: PaginationMeta;
}

export interface WindowDishesData {
  items: Dish[];
  meta: PaginationMeta;
}


/**
 * 菜品列表请求
 */
export interface GetDishesRequest {
  filter: {
    // --- 基础筛选 ---
    includeOffline?: boolean;
    canteenId?: string[];
    tag?: string[];

    // --- 范围筛选 ---
    rating?: {
      min: number;
      max: number;
    };
    price?: {
      min: number;
      max: number;
    };
    
    mealTime?: string[]; 

    // 口味范围筛选（必须是范围对象，不能是单个数字）
    oiliness?: {
      min: number;
      max: number;
    };
    saltiness?: {
      min: number;
      max: number;
    };
    spicyLevel?: {
      min: number;
      max: number;
    };
    sweetness?: {
      min: number;
      max: number;
    };

    meatPreference?: string[];      // 肉类偏好
    avoidIngredients?: string[];    // 忌口
    favoriteIngredients?: string[]; // 喜好食材
  };
  search: {
    keyword: string;
    fields?: string[];
  };
  sort: {
    field?: string;
    order?: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    pageSize: number;
  };
}

/**
 * 用户上传菜品请求
 */
export interface DishUserCreateRequest {
  name?: string;
  tags?: string[];
  price: number;
  description?: string;
  images?: string[];
  parentDishId?: string;
  subDishId?: string[];
  ingredients?: string[];
  allergens?: string[];
  canteenId?: string;
  canteenName: string;
  floor?: string;
  windowNumber?: string;
  windowName: string;
  availableMealTime: ('breakfast' | 'lunch' | 'dinner' | 'nightsnack')[];
  availableDates?: Array<{
    startDate: string;
    endDate: string;
  }>;
  status?: 'online' | 'offline';
}

/**
 * 管理员创建菜品请求
 */
export interface DishCreateRequest {
  name: string;
  tags?: string[];
  price: number;
  description?: string;
  images?: string[];
  parentDishId?: string;
  subDishId?: string[];
  ingredients?: string[];
  allergens?: string[];
  canteenId?: string;
  canteenName: string;
  floor?: string;
  windowNumber?: string;
  windowName: string;
  availableMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'nightsnack')[];
  availableDates?: Array<{
    startDate: string;
    endDate: string;
  }>;
  status?: 'online' | 'offline';
}

/**
 * 管理员更新菜品请求
 */
export interface DishUpdateRequest {
  name?: string;
  tags?: string[];
  price?: number;
  description?: string;
  images?: string[];
  parentDishId?: string;
  subDishId?: string[];
  ingredients?: string[];
  allergens?: string[];
  canteenId?: string;
  canteenName?: string;
  floor?: string;
  windowNumber?: string;
  windowName?: string;
  availableMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'nightsnack')[];
  availableDates?: Array<{
    startDate: string;
    endDate: string;
  }>;
  status?: 'online' | 'offline';
}

/**
 * 创建食堂请求
 */
export interface CanteenCreateRequest {
  id: string;
  name: string;
  position?: string;
  description?: string;
  images?: string[];
  operatingHours?: string;
  averageRating?: number;
  reviewCount?: number;
  windowsList?: Window[];
}

/**
 * 更新食堂请求
 */
export interface CanteenUpdateRequest {
  id?: string;
  name?: string;
  position?: string;
  description?: string;
  images?: string[];
  operatingHours?: string;
  averageRating?: number;
  reviewCount?: number;
  windowsList?: Window[];
}

/**
 * 创建窗口请求
 */
export interface WindowCreateRequest {
  id: string;
  name: string;
  number: string;
  position?: string;
  description?: string;
  tag?: string[];
}

/**
 * 更新窗口请求
 */
export interface WindowUpdateRequest {
  id?: string;
  name?: string;
  number?: string;
  position?: string;
  description?: string;
  tag?: string[];
}

/**
 * 创建评价请求
 */
export interface ReviewCreateRequest {
  dishId: string;
  rating: number;
  content?: string;
  images?: string[];
}

/**
 * 创建评论请求
 */
export interface CommentCreateRequest {
  reviewId: string;
  content: string;
}

/**
 * 举报请求
 */
export interface ReportRequest {
  type: 'inappropriate' | 'spam' | 'false_info' | 'other';
  reason: string;
}

/**
 * 处理举报请求
 */
export interface ReportHandleRequest {
  action: 'delete_content' | 'warn_user' | 'reject_report';
  result?: string;
}

/**
 * 饮食计划请求
 */
export interface MealPlanRequest {
  startDate?: string;
  endDate?: string;
  mealTime?: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack';
  dishes?: string[];
}

/**
 * AI推荐请求
 */
export interface AIRecommendRequest {
  userPreference?: Partial<UserPreference>;
}

/**
 * 推荐反馈请求
 */
export interface RecommendFeedbackRequest {
  dishId: string;
  feedback: 'like' | 'dislike';
}

/**
 * 食堂列表响应数据
 */

/**
 * 更新用户信息请求
 */
export interface UserProfileUpdateRequest {
  nickname?: string;
  avatar?: string;
  preferences?: Partial<UserPreference>;
  allergens?: string[];
}

/**
 * 新闻创建请求
 */
export interface NewsCreateRequest {
  title: string;
  content: string;
  summary?: string;
  canteenId?: string;
  publishedAt: string;
}

/**
 * 新闻更新请求
 */
export interface NewsUpdateRequest {
  title?: string;
  content?: string;
  summary?: string;
  publishedAt?: string;
}

/**
 * 管理员创建请求
 */
export interface AdminCreateRequest {
  username: string;
  password: string;
  canteenId?: string | null;
  permissions: string[];
}

// ============================================
// API 响应数据类型（data 字段的类型）
// ============================================

/**
 * 登录响应数据
 */
export interface LoginData {
    token?: Token;
    user?: User;
}

/**
 * JWT Token
 */
export interface Token {
    accessToken?: string;
    refreshToken?: string;
}

/**
 * 管理员登录响应数据
 */
export interface AdminLoginData {
  token: string;
  admin: Admin;
  permissions: string[];
}

/**
 * 菜品上传响应数据
 */
export interface DishUploadData {
  id: string;
  status: 'pending';
}

/**
 * 评价列表扩展数据
 */
export interface ReviewListData extends PaginatedData<Review> {
  rating?: {
    average: number;
    total: number;
    detail: Record<string, number>;
  };
}

/**
 * 我的评价列表项
 */
export interface MyReviewItem extends Review {
  dishName: string;
  dishImage: string;
}

/**
 * 我的上传列表项
 */
export interface MyUploadItem {
  id: string;
  name: string;
  canteenName: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string | null;
  createdAt: string;
}

/**
 * 浏览历史项
 */
export interface BrowseHistoryItem {
  dishId: string;
  viewedAt: string;
}

/**
 * 用户信息项
 */
export interface MyUserProfileResponse {
    code?: number;
    data?: User;
    message?: string;
    [property: string]: any;
}


export interface UserInfoItem extends User {
  preferenceSummary?: string;
}

/**
 * AI推荐项
 */
export interface RecommendationItem {
  dish: Dish;
  reason: string;
  score: number;
}

/**
 * AI推荐响应数据
 */
export interface AIRecommendData {
  recommendations: RecommendationItem[];
}

/**
 * 图片上传响应数据
 */
export interface ImageUploadData {
  url: string;
  filename: string;
}

/**
 * 待审核评论列表项
 */
export interface PendingCommentItem extends Comment {
  reviewContent: string;
  dishName: string;
}

/**
 * 待审核评价列表项
 */
export interface PendingReviewItem extends Review {
  dishName: string;
  dishImage: string;
}

/**
 * 待审核上传列表项
 */
export interface PendingUploadItem {
  id: string;
  name: string;
  canteenId: string;
  canteenName: string;
  price: number;
  window: string;
  ingredients: string;
  allergens: string[];
  images: string[];
  uploaderId: string;
  uploaderNickname: string;
  createdAt: string;
}

/**
 * 管理员列表项
 */
export interface AdminListItem extends Admin {
  permissions: string[];
}

// ============================================
// 请求配置类型
// ============================================

/**
 * 请求配置选项
 */
export interface RequestOptions {
  url: string;
  method?: RequestMethod;
  data?: Record<string, any> | any[];
  header?: Record<string, string>;
  timeout?: number;
}

/**
 * 获取食堂列表
 */
export function getCanteenList(params?: PaginationParams): Promise<ApiResponse<CanteenListData>>;

/**
 * 获取食堂详情
 */
export function getCanteenDetail(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<Canteen>>;

/**
 * 获取窗口列表（根据食堂ID）
 */
export function getWindowList(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowListData>>;

/**
 * 获取窗口详情
 */
export function getWindowDetail(
  windowId: string,
  params?: PaginationParams
): Promise<ApiResponse<Window>>;

// ==================== 管理端 - 食堂接口 ====================

/**
 * 管理端获取食堂列表
 */
export function adminGetCanteenList(params?: PaginationParams): Promise<ApiResponse<CanteenListData>>;

/**
 * 管理端获取窗口列表
 */
export function adminGetWindowList(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowListData>>;

/**
 * 新建食堂
 */
export function createCanteen(data: CanteenCreateRequest): Promise<ApiResponse<Canteen>>;

/**
 * 编辑食堂
 */
export function updateCanteen(
  id: string,
  data: CanteenUpdateRequest
): Promise<ApiResponse<Canteen>>;

/**
 * 删除食堂
 */
export function deleteCanteen(id: string): Promise<ApiResponse<null>>;

/**
 * 新建窗口
 */
export function createWindow(data: WindowCreateRequest): Promise<ApiResponse<Window>>;

/**
 * 编辑窗口
 */
export function updateWindow(
  id: string,
  data: WindowUpdateRequest
): Promise<ApiResponse<Window>>;

/**
 * 删除窗口
 */
export function deleteWindow(id: string): Promise<ApiResponse<null>>;