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
import { 
  USE_MOCK, 
  mockGetCanteenList, 
  mockGetCanteenDetail,
  mockGetWindowList,
  mockGetWindowDetail,
  mockGetWindowDishes,
} from '@/mock';

// ==================== 用户端 - 食堂接口 ====================

/**
 * 获取食堂列表
 */
export async function getCanteenList(params?: PaginationParams): Promise<ApiResponse<CanteenListData>> {
  if (USE_MOCK) {
    const data = await mockGetCanteenList();
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  
  return request<CanteenListData>({
    url: '/canteens',
    method: 'GET',
    data:params,
  });
}

/**
 * 获取食堂详情
 */
export async function getCanteenDetail(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<Canteen>> {
  if (USE_MOCK) {
    const data = await mockGetCanteenDetail(canteenId);
    if (!data) {
      return {
        code: 404,
        message: 'Canteen not found',
        data: null as any,
      };
    }
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  
  return request<Canteen>({
    url: `/canteens/${canteenId}`,
    method: 'GET',
    data:params,
  });
}

/**
 * 获取窗口列表（根据食堂ID）
 */
export async function getWindowList(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowListData>> {
  if (USE_MOCK) {
    const data = await mockGetWindowList(canteenId);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  
  return request<WindowListData>({
    url: `/canteens/${canteenId}/windows`,
    method: 'GET',
    data:params,
  });
}

/**
 * 获取窗口详情
 */
export async function getWindowDetail(
  windowId: string,
  params?: PaginationParams
): Promise<ApiResponse<Window>> {
  if (USE_MOCK) {
    const data = await mockGetWindowDetail(windowId);
    if (!data) {
      return {
        code: 404,
        message: 'Window not found',
        data: null as any,
      };
    }
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  
  return request<Window>({
    url: `/windows/${windowId}`,
    method: 'GET',
  });
}

/**
 * 获取窗口菜品列表
 */
export async function getWindowDishes(
  windowId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowDishesData>> {
  if (USE_MOCK) {
    const data = await mockGetWindowDishes(windowId);
    return {
      code: 200,
      message: 'Success',
      data,
    };
  }
  
  return request<WindowDishesData>({
    url: `/windows/${windowId}/dishes`,
    method: 'GET',
  });
}
