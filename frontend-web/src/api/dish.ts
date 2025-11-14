import request from './request'
import type { Dish, CreateDishData, UpdateDishData, PaginationParams, PaginationResponse } from './types'

/**
 * 菜品相关 API
 */
export const dishApi = {
  /**
   * 获取菜品列表
   * @param params 查询参数（可选）
   * @returns 菜品列表
   */
  async getDishes(params?: PaginationParams): Promise<Dish[]> {
    // 模拟 API 调用（保留原有接口）
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: 1, name: '示例菜品', canteen: '紫荆园', status: 'active' }
        ])
      }, 500)
    })
  },

  /**
   * 添加菜品
   * @param dishData 菜品数据
   * @returns 创建结果
   */
  async addDish(dishData: CreateDishData): Promise<{ success: boolean; id: number | string }> {
    console.log('添加菜品:', dishData)
    // 模拟 API 调用（保留原有接口）
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, id: Date.now() })
      }, 500)
    })
  },

  /**
   * 更新菜品
   * @param id 菜品 ID
   * @param dishData 更新的菜品数据
   * @returns 更新结果
   */
  async updateDish(id: string | number, dishData: Partial<CreateDishData>): Promise<{ success: boolean }> {
    console.log('更新菜品:', id, dishData)
    // 模拟 API 调用（保留原有接口）
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true })
      }, 500)
    })
  },

  /**
   * 删除菜品
   * @param id 菜品 ID
   * @returns 删除结果
   */
  async deleteDish(id: string | number): Promise<{ success: boolean }> {
    console.log('删除菜品:', id)
    // 模拟 API 调用（保留原有接口）
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true })
      }, 500)
    })
  },

  /**
   * 上传 Excel 文件
   * @param file Excel 文件
   * @returns 解析结果
   */
  async uploadExcel(file: File): Promise<{ success: boolean; data: any[] }> {
    console.log('上传Excel文件:', file.name)
    // 模拟 API 调用（保留原有接口）
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ 
          success: true, 
          data: [
            { id: 1, name: '麻婆豆腐', canteen: '紫荆园', status: '有效' }
          ] 
        })
      }, 1000)
    })
  }
}

export default dishApi

