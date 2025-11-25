import request from '@/utils/request';
import type {
  Canteen,
  Window,
  CanteenListData,
  WindowListData,
  PaginationParams,
  CanteenCreateRequest,
  CanteenUpdateRequest,
  WindowCreateRequest,
  WindowUpdateRequest,
  WindowDishesData,
} from '@/types/api';
import type { ApiResponse } from '@/types/api';

// ==================== 用户端 - 食堂接口 ====================

/**
 * 获取食堂列表
 */
export function getCanteenList(params?: PaginationParams): Promise<ApiResponse<CanteenListData>> {
  return request<CanteenListData>({
    url: '/canteens',
    method: 'GET',
    data:params,
  });
}

/**
 * 获取食堂详情
 */
export function getCanteenDetail(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<Canteen>> {
  return request<Canteen>({
    url: `/canteens/${canteenId}`,
    method: 'GET',
  });
}

/**
 * 获取窗口列表（根据食堂ID）
 */
export function getWindowList(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowListData>> {
  return request<WindowListData>({
    url: `/windows/${canteenId}`,
    method: 'GET',
  });
}

/**
 * 获取窗口详情
 */
export function getWindowDetail(
  windowId: string,
  params?: PaginationParams
): Promise<ApiResponse<Window>> {
  return request<Window>({
    url: `/windows/${windowId}`,
    method: 'GET',
  });
}

/**
 * 获取窗口菜品列表
 */
export function getWindowDishes(
  windowId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowDishesData>> {
  return request<WindowDishesData>({
    url: `/windows/${windowId}/dishes`,
    method: 'GET',
  });
}
