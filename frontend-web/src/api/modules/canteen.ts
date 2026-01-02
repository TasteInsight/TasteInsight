import request from '@/utils/request'
import type {
  Canteen,
  Window,
  PaginationResponse,
  ApiResponse,
  CanteenCreateRequest,
  CanteenUpdateRequest,
  WindowCreateRequest,
  WindowUpdateRequest,
} from '@/types/api'

/**
 * 食堂和窗口管理 API
 */
export const canteenApi = {
  /**
   * 获取食堂列表
   * @param params 分页参数
   * @returns 食堂列表
   */
  async getCanteens(
    params: { page?: number; pageSize?: number } = {},
  ): Promise<ApiResponse<PaginationResponse<Canteen>>> {
    return await request.get<ApiResponse<PaginationResponse<Canteen>>>('/admin/canteens', {
      params,
    })
  },

  /**
   * 创建食堂
   * @param data 食堂数据
   * @returns 创建的食堂信息
   */
  async createCanteen(data: CanteenCreateRequest): Promise<ApiResponse<Canteen>> {
    return await request.post<ApiResponse<Canteen>>('/admin/canteens', data)
  },

  /**
   * 更新食堂
   * @param id 食堂 ID
   * @param data 更新的食堂数据
   * @returns 更新后的食堂信息
   */
  async updateCanteen(id: string, data: CanteenUpdateRequest): Promise<ApiResponse<Canteen>> {
    return await request.put<ApiResponse<Canteen>>(`/admin/canteens/${id}`, data)
  },

  /**
   * 删除食堂
   * @param id 食堂 ID
   * @returns 删除结果
   */
  async deleteCanteen(id: string): Promise<ApiResponse<void>> {
    return await request.delete<ApiResponse<void>>(`/admin/canteens/${id}`)
  },

  /**
   * 获取窗口列表
   * @param canteenId 食堂 ID
   * @param params 分页参数
   * @returns 窗口列表
   */
  async getWindows(
    canteenId: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<ApiResponse<PaginationResponse<Window>>> {
    return await request.get<ApiResponse<PaginationResponse<Window>>>(
      `/admin/canteens/${canteenId}/windows`,
      { params },
    )
  },

  /**
   * 创建窗口
   * @param data 窗口数据
   * @returns 创建的窗口信息
   */
  async createWindow(data: WindowCreateRequest): Promise<ApiResponse<Window>> {
    return await request.post<ApiResponse<Window>>('/admin/windows', data)
  },

  /**
   * 更新窗口
   * @param id 窗口 ID
   * @param data 更新的窗口数据
   * @returns 更新后的窗口信息
   */
  async updateWindow(id: string, data: WindowUpdateRequest): Promise<ApiResponse<Window>> {
    return await request.put<ApiResponse<Window>>(`/admin/windows/${id}`, data)
  },

  /**
   * 删除窗口
   * @param id 窗口 ID
   * @returns 删除结果
   */
  async deleteWindow(id: string): Promise<ApiResponse<void>> {
    return await request.delete<ApiResponse<void>>(`/admin/windows/${id}`)
  },
}

export default canteenApi
