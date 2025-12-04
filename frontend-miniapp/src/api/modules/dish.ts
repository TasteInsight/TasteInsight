// @/api/modules/dish.ts
import request from '@/utils/request';
import type {
  Dish,
  GetDishesRequest,
  PaginatedData,
  DishUserCreateRequest,
  DishUploadData,
  ApiResponse,
  DishesImages
} from '@/types/api';

/**
 * 获取菜品详情
 */
export const getDishById = (
  id: string
): Promise<ApiResponse<Dish>> => {
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
 *  获取菜品图片列表
 */
export const getDishesImages = (
): Promise<ApiResponse<DishesImages>> => {
  return request<DishesImages>({
    url: '/dishes/images',
    method: 'GET',
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