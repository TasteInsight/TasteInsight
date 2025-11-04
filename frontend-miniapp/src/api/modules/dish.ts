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

/**
 * 获取菜品详情
 */
export const getDishById = (
  id: string
): Promise<ApiResponse<Dish>> => {
  return request<ApiResponse<Dish>>({
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
  return request<ApiResponse<PaginatedData<Dish>>>({
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
): Promise<SuccessResponse> => {
  return request<SuccessResponse>({
    url: `/dishes/${dishId}/favorite`,
    method: 'POST',
  });
};

/**
 * 取消收藏菜品
 */
export const unfavoriteDish = (dishId: string): Promise<SuccessResponse> => {
  return request<SuccessResponse>({
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
  return request<ApiResponse<DishUploadData>>({
    url: '/dishes/upload',
    method: 'POST',
    data: dishData,
  });
};