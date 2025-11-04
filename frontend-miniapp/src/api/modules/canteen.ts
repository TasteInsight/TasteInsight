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
} from '@/types/api';
import type { ApiResponse } from '@/types/api';

// ==================== 用户端 - 食堂接口 ====================

/**
 * 获取食堂列表
 */
export function getCanteenList(params?: PaginationParams): Promise<ApiResponse<CanteenListData>> {
  return request({
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
  return request({
    url: `/canteens/${canteenId}`,
    method: 'GET',
    data:params,
  });
}

/**
 * 获取窗口列表（根据食堂ID）
 */
export function getWindowList(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowListData>> {
  return request({
    url: `/windows/${canteenId}`,
    method: 'GET',
    data:params,
  });
}

/**
 * 获取窗口详情
 */
export function getWindowDetail(
  windowId: string,
  params?: PaginationParams
): Promise<ApiResponse<Window>> {
  return request({
    url: `/windows/${windowId}`,
    method: 'GET',
    data: params,
  });
}

// ==================== 管理端 - 食堂接口 ====================

/**
 * 管理端获取食堂列表
 */
export function adminGetCanteenList(params?: PaginationParams): Promise<ApiResponse<CanteenListData>> {
  return request({
    url: '/admin/canteens',
    method: 'GET',
    data:params,
  });
}

/**
 * 管理端获取窗口列表
 */
export function adminGetWindowList(
  canteenId: string,
  params?: PaginationParams
): Promise<ApiResponse<WindowListData>> {
  return request({
    url: `/admin/windows/${canteenId}`,
    method: 'GET',
    data:params,
  });
}

/**
 * 新建食堂
 */
export function createCanteen(data: CanteenCreateRequest): Promise<ApiResponse<Canteen>> {
  return request({
    url: '/admin/canteens',
    method: 'POST',
    data,
  });
}

/**
 * 编辑食堂
 */
export function updateCanteen(id: string, data: CanteenUpdateRequest): Promise<ApiResponse<Canteen>> {
  return request({
    url: `/admin/canteens/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除食堂
 */
export function deleteCanteen(id: string): Promise<ApiResponse<null>> {
  return request({
    url: `/admin/canteens/${id}`,
    method: 'DELETE',
  });
}

/**
 * 新建窗口
 */
export function createWindow(data: WindowCreateRequest): Promise<ApiResponse<Window>> {
  return request({
    url: '/admin/windows',
    method: 'POST',
    data,
  });
}

/**
 * 编辑窗口
 */
export function updateWindow(id: string, data: WindowUpdateRequest): Promise<ApiResponse<Window>> {
  return request({
    url: `/admin/windows/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除窗口
 */
export function deleteWindow(id: string): Promise<ApiResponse<null>> {
  return request({
    url: `/admin/windows/${id}`,
    method: 'DELETE',
  });
}