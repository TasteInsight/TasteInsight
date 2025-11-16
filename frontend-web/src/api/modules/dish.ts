import request from '@/utils/request'
import type { 
  Dish, 
  DishCreateRequest, 
  DishUpdateRequest,
  GetDishesParams,
  PaginationResponse,
  ApiResponse,
  SuccessResponse
} from '@/types/api'

/**
 * 菜品相关 API
 */
export const dishApi = {
  /**
   * 管理端获取菜品列表
   * @param params 查询参数
   * @returns 菜品列表（分页）
   */
  async getDishes(params?: GetDishesParams): Promise<ApiResponse<PaginationResponse<Dish>>> {
    const response = await request.get<ApiResponse<PaginationResponse<Dish>>>('/admin/dishes', { params })
    return response
  },

  /**
   * 创建新菜品
   * @param dishData 菜品数据
   * @returns 创建的菜品信息
   */
  async createDish(dishData: DishCreateRequest): Promise<ApiResponse<Dish>> {
    const response = await request.post<ApiResponse<Dish>>('/admin/dishes', dishData)
    return response
  },

  /**
   * 更新菜品
   * @param id 菜品 ID
   * @param dishData 更新的菜品数据
   * @returns 更新后的菜品信息
   */
  async updateDish(id: string, dishData: DishUpdateRequest): Promise<ApiResponse<Dish>> {
    const response = await request.put<ApiResponse<Dish>>(`/admin/dishes/${id}`, dishData)
    return response
  },

  /**
   * 删除菜品
   * @param id 菜品 ID
   * @returns 删除结果
   */
  async deleteDish(id: string): Promise<ApiResponse<SuccessResponse>> {
    const response = await request.delete<ApiResponse<SuccessResponse>>(`/admin/dishes/${id}`)
    return response
  },

  /**
   * 批量上传菜品
   * @param file Excel 文件
   * @returns 上传结果
   */
  async batchUpload(file: File): Promise<ApiResponse<SuccessResponse>> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await request.post<ApiResponse<SuccessResponse>>('/admin/dishes/batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response
  },

  /**
   * 修改菜品状态
   * @param id 菜品 ID
   * @param status 菜品状态（online 或 offline）
   * @returns 修改结果
   */
  async updateDishStatus(id: string, status: 'online' | 'offline'): Promise<ApiResponse<SuccessResponse>> {
    const response = await request.patch<ApiResponse<SuccessResponse>>(`/admin/dishes/${id}/status`, { status })
    return response
  }
}

export default dishApi
