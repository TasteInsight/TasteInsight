import request from '@/utils/request'
import type {
  ApiResponse,
  PaginationParams,
  ConfigTemplate,
  ConfigTemplatesResponse,
  GlobalConfigResponse,
  CanteenConfigResponse,
  EffectiveConfigResponse,
  ConfigItem,
  UpdateConfigRequest,
} from '@/types/api'

/**
 * 配置管理 API
 */
export const configApi = {
  /**
   * 获取配置模板列表
   * @param params 分页参数
   * @returns 配置模板列表
   */
  async getTemplates(
    params: PaginationParams = {},
  ): Promise<ApiResponse<ConfigTemplatesResponse>> {
    return await request.get<ApiResponse<ConfigTemplatesResponse>>('/admin/config/templates', {
      params,
    })
  },

  /**
   * 获取全局配置
   * @returns 全局配置信息（包含配置项和模板）
   */
  async getGlobalConfig(): Promise<ApiResponse<GlobalConfigResponse>> {
    return await request.get<ApiResponse<GlobalConfigResponse>>('/admin/config/global')
  },

  /**
   * 更新全局配置项
   * @param data 更新配置请求
   * @returns 更新后的配置项
   */
  async updateGlobalConfig(data: UpdateConfigRequest): Promise<ApiResponse<ConfigItem>> {
    return await request.put<ApiResponse<ConfigItem>>('/admin/config/global', data)
  },

  /**
   * 获取食堂配置
   * @param canteenId 食堂ID
   * @returns 食堂配置信息（包含配置项、全局配置和模板）
   */
  async getCanteenConfig(canteenId: string): Promise<ApiResponse<CanteenConfigResponse>> {
    return await request.get<ApiResponse<CanteenConfigResponse>>(
      `/admin/config/canteen/${canteenId}`,
    )
  },

  /**
   * 更新食堂配置项
   * @param canteenId 食堂ID
   * @param data 更新配置请求
   * @returns 更新后的配置项
   */
  async updateCanteenConfig(
    canteenId: string,
    data: UpdateConfigRequest,
  ): Promise<ApiResponse<ConfigItem>> {
    return await request.put<ApiResponse<ConfigItem>>(
      `/admin/config/canteen/${canteenId}`,
      data,
    )
  },

  /**
   * 获取食堂有效配置（合并食堂、全局和默认值）
   * @param canteenId 食堂ID
   * @returns 有效配置列表
   */
  async getEffectiveConfig(canteenId: string): Promise<ApiResponse<EffectiveConfigResponse>> {
    return await request.get<ApiResponse<EffectiveConfigResponse>>(
      `/admin/config/canteen/${canteenId}/effective`,
    )
  },

  /**
   * 删除食堂配置项（将回退到全局/默认值）
   * @param canteenId 食堂ID
   * @param key 配置键名
   * @returns 删除结果
   */
  async deleteCanteenConfigItem(
    canteenId: string,
    key: string,
  ): Promise<ApiResponse<void>> {
    return await request.delete<ApiResponse<void>>(
      `/admin/config/canteen/${canteenId}/${key}`,
    )
  },
}

export default configApi

