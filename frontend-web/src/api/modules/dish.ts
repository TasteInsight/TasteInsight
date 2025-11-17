import request from '@/utils/request'
import type { 
  Dish, 
  DishCreateRequest, 
  DishUpdateRequest,
  GetDishesParams,
  GetDishReviewsParams,
  DishReviewsData,
  PaginationResponse,
  ApiResponse,
  ImageUploadResponse
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
   * 根据 ID 获取单个菜品详情
   * @param id 菜品 ID
   * @returns 菜品信息
   */
  async getDishById(id: string): Promise<ApiResponse<Dish>> {
    // 尝试直接通过 ID 获取（如果后端支持 GET /admin/dishes/{id}）
    try {
      const response = await request.get<ApiResponse<Dish>>(`/admin/dishes/${id}`)
      if (response.code === 200 && response.data) {
        return response
      }
    } catch (error) {
      // 如果直接获取失败，通过列表接口获取，然后筛选
      console.log('直接获取失败，尝试通过列表接口获取:', error)
    }
    
    // 通过列表接口获取所有菜品，然后筛选
    const response = await request.get<ApiResponse<PaginationResponse<Dish>>>('/admin/dishes', {
      params: { pageSize: 1000 } // 获取足够多的数据以便找到目标菜品
    })
    
    if (response.code === 200 && response.data) {
      const dish = response.data.items.find(d => d.id === id)
      if (dish) {
        return {
          code: 200,
          message: '获取成功',
          data: dish
        }
      }
    }
    
    // 如果没找到，返回错误
    return Promise.reject(new Error('未找到该菜品'))
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
  async deleteDish(id: string): Promise<ApiResponse<void>> {
    const response = await request.delete<ApiResponse<void>>(`/admin/dishes/${id}`);
    return response;
  },

  /**
   * 批量上传菜品
   * @param file Excel 文件
   * @returns 上传结果
   */
  async batchUpload(file: File): Promise<ApiResponse<void>> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await request.post<ApiResponse<void>>('/admin/dishes/batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response;
  },

  /**
   * 修改菜品状态
   * @param id 菜品 ID
   * @param status 菜品状态（online 或 offline）
   * @returns 修改结果
   */
  async updateDishStatus(id: string, status: 'online' | 'offline'): Promise<ApiResponse<void>> {
    const response = await request.patch<ApiResponse<void>>(`/admin/dishes/${id}/status`, { status });
    return response;
  },

  /**
   * 上传图片
   * @param file 图片文件
   * @returns 上传后的图片 URL
   */
  async uploadImage(file: File): Promise<ApiResponse<ImageUploadResponse>> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await request.post<ApiResponse<ImageUploadResponse>>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response
  },

  /**
   * 获取菜品评价列表
   * @param id 菜品 ID
   * @param params 查询参数（分页、状态筛选）
   * @returns 评价列表及统计信息
   */
  async getDishReviews(id: string, params?: GetDishReviewsParams): Promise<ApiResponse<DishReviewsData>> {
    const response = await request.get<ApiResponse<DishReviewsData>>(`/admin/dishes/${id}/reviews`, { params });
    return response;
  }
}

export default dishApi
