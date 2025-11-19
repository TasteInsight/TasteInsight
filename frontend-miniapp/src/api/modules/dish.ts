// @/api/modules/dish.ts
import request from '@/utils/request';
import type {
  Dish,
  GetDishesRequest,
  PaginatedData,
  DishUserCreateRequest,
  DishUploadData,
  ApiResponse,
  SuccessResponse,
} from '@/types/api';

// ========== Mock 配置 ==========
const USE_MOCK = true;

// 模拟网络延迟
const mockDelay = (ms: number = 300) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Mock 菜品数据库
const createMockDishes = (): Record<string, Dish> => ({
  dish_001: {
    id: 'dish_001',
    name: '宫保鸡丁',
    tags: ['川菜', '热门', '辣'],
    price: 12.5,
    description: '经典川菜，鸡肉鲜嫩，花生酥脆，酸甜微辣',
    images: ['https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=宫保鸡丁'],
    ingredients: ['鸡肉', '花生', '辣椒', '葱'],
    allergens: ['花生'],
    canteenId: 'canteen_001',
    canteenName: '一食堂',
    floor: '二楼',
    windowNumber: '5',
    windowName: '川味窗口',
    availableMealTime: ['lunch', 'dinner'],
    status: 'online',
    averageRating: 4.5,
    reviewCount: 128,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-11-19T00:00:00.000Z',
  },
  dish_002: {
    id: 'dish_002',
    name: '麻婆豆腐',
    tags: ['川菜', '素食可选', '辣'],
    price: 8.0,
    description: '麻辣鲜香，豆腐嫩滑，开胃下饭',
    images: ['https://via.placeholder.com/400x300/4ECDC4/FFFFFF?text=麻婆豆腐'],
    ingredients: ['豆腐', '牛肉末', '花椒', '辣椒'],
    allergens: [],
    canteenId: 'canteen_001',
    canteenName: '一食堂',
    floor: '二楼',
    windowNumber: '5',
    windowName: '川味窗口',
    availableMealTime: ['lunch', 'dinner'],
    status: 'online',
    averageRating: 4.2,
    reviewCount: 96,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-11-19T00:00:00.000Z',
  },
  dish_003: {
    id: 'dish_003',
    name: '鱼香肉丝',
    tags: ['川菜', '热门'],
    price: 10.0,
    description: '酸甜可口，色泽红亮，肉丝嫩滑',
    images: ['https://via.placeholder.com/400x300/95E1D3/FFFFFF?text=鱼香肉丝'],
    ingredients: ['猪肉', '木耳', '胡萝卜', '笋'],
    allergens: [],
    canteenId: 'canteen_002',
    canteenName: '二食堂',
    floor: '一楼',
    windowNumber: '3',
    windowName: '家常菜窗口',
    availableMealTime: ['lunch', 'dinner'],
    status: 'online',
    averageRating: 4.8,
    reviewCount: 203,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-11-19T00:00:00.000Z',
  },
  dish_004: {
    id: 'dish_004',
    name: '清炒时蔬',
    tags: ['素食', '健康', '清淡'],
    price: 6.0,
    description: '新鲜时令蔬菜，清淡爽口，营养健康',
    images: ['https://via.placeholder.com/400x300/38A3A5/FFFFFF?text=清炒时蔬'],
    ingredients: ['西兰花', '胡萝卜', '木耳', '蘑菇'],
    allergens: [],
    canteenId: 'canteen_002',
    canteenName: '二食堂',
    floor: '一楼',
    windowNumber: '2',
    windowName: '素食窗口',
    availableMealTime: ['breakfast', 'lunch', 'dinner'],
    status: 'online',
    averageRating: 4.0,
    reviewCount: 67,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-11-19T00:00:00.000Z',
  },
  dish_005: {
    id: 'dish_005',
    name: '红烧肉',
    tags: ['热门', '肉食', '甜'],
    price: 15.0,
    description: '肥而不腻，入口即化，色泽红亮诱人',
    images: ['https://via.placeholder.com/400x300/C7254E/FFFFFF?text=红烧肉'],
    ingredients: ['五花肉', '冰糖', '酱油', '八角'],
    allergens: [],
    canteenId: 'canteen_001',
    canteenName: '一食堂',
    floor: '二楼',
    windowNumber: '6',
    windowName: '特色窗口',
    availableMealTime: ['lunch', 'dinner'],
    status: 'online',
    averageRating: 4.8,
    reviewCount: 245,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-11-19T00:00:00.000Z',
  },
});

const mockDishDatabase = createMockDishes();
// ========== End Mock 配置 ==========

/**
 * 获取菜品详情
 */
export const getDishById = async (
  id: string
): Promise<ApiResponse<Dish>> => {
  if (USE_MOCK) {
    await mockDelay(200);
    const dish = mockDishDatabase[id];
    
    if (!dish) {
      console.warn(`🍽️ [Mock] 菜品不存在: ${id}`);
      return {
        code: 404,
        message: '菜品不存在',
        data: null as any,
      };
    }
    
    console.log(`🍽️ [Mock] 获取菜品详情: ${dish.name}`, dish);
    return {
      code: 200,
      message: 'Success',
      data: dish,
    };
  }
  
  return request<Dish>({
    url: `/dishes/${id}`,
    method: 'GET',
  });
};

/**
 * 获取菜品列表
 */
export const getDishes = (
  params: GetDishesRequest
): Promise<ApiResponse<PaginatedData<Dish>>> => {
  return request<PaginatedData<Dish>>({
    url: '/dishes',
    method: 'POST',
    data: params,
  });
};

/**
 * 收藏菜品
 */
export const favoriteDish = (
  dishId: string
): Promise<ApiResponse<null>> => {
  return request<null>({
    url: `/dishes/${dishId}/favorite`,
    method: 'POST',
  });
};

/**
 * 取消收藏菜品
 */
export const unfavoriteDish = (dishId: string): Promise<ApiResponse<null>> => {
  return request<null>({
    url: `/dishes/${dishId}/favorite`,
    method: 'DELETE',
  });
};

/**
 * 用户上传菜品
 */
export const uploadDish = (
  dishData: DishUserCreateRequest
): Promise<ApiResponse<DishUploadData>> => {
  return request<DishUploadData>({
    url: '/dishes/upload',
    method: 'POST',
    data: dishData,
  });
};