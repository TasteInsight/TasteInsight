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
import { USE_MOCK, mockGetDishById, mockGetDishes } from '@/mock';

/**
 * 获取菜品详情
 */
export const getDishById = async (
  id: string
): Promise<ApiResponse<Dish>> => {
  if (USE_MOCK) {
    const dish = await mockGetDishById(id);
    
    if (!dish) {
      return {
        code: 404,
        message: '菜品不存在',
        data: null as any,
      };
    }
    
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
export const getDishes = async (
  params: GetDishesRequest
): Promise<ApiResponse<PaginatedData<Dish>>> => {
  if (USE_MOCK) {
    const data = await mockGetDishes(params);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }

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