import request from '@/utils/request'
import type {
  ApiResponse,
  Experiment,
  CreateExperimentRequest,
  UpdateExperimentRequest,
  EvaluateRecallQualityParams,
  RecallQualityEvaluationData,
} from '@/types/api'

/**
 * 实验管理相关 API
 */
export const experimentApi = {
  /**
   * 获取所有 A/B 测试实验列表
   * GET /admin/experiments
   * @returns 实验列表
   */
  async getExperiments(): Promise<ApiResponse<Experiment[]>> {
    const response = await request.get<ApiResponse<Experiment[]>>('/admin/experiments')
    return response
  },

  /**
   * 创建新的 A/B 测试实验
   * POST /admin/experiments
   * @param params 创建实验参数
   * @returns 创建的实验详情
   */
  async createExperiment(
    params: CreateExperimentRequest,
  ): Promise<ApiResponse<Experiment>> {
    const response = await request.post<ApiResponse<Experiment>>('/admin/experiments', params)
    return response
  },

  /**
   * 根据ID获取实验详情
   * GET /admin/experiments/{id}
   * @param id 实验ID
   * @returns 实验详情
   */
  async getExperimentById(id: string): Promise<ApiResponse<Experiment>> {
    const response = await request.get<ApiResponse<Experiment>>(`/admin/experiments/${id}`)
    return response
  },

  /**
   * 更新实验配置
   * PUT /admin/experiments/{id}
   * @param id 实验ID
   * @param params 更新实验参数
   * @returns 更新后的实验详情
   */
  async updateExperiment(
    id: string,
    params: UpdateExperimentRequest,
  ): Promise<ApiResponse<Experiment>> {
    const response = await request.put<ApiResponse<Experiment>>(
      `/admin/experiments/${id}`,
      params,
    )
    return response
  },

  /**
   * 删除指定实验
   * DELETE /admin/experiments/{id}
   * @param id 实验ID
   * @returns 删除结果
   */
  async deleteExperiment(id: string): Promise<ApiResponse<void>> {
    const response = await request.delete<ApiResponse<void>>(`/admin/experiments/${id}`)
    return response
  },

  /**
   * 启用指定的 A/B 测试实验
   * POST /admin/experiments/{id}/enable
   * @param id 实验ID
   * @returns 操作结果
   */
  async enableExperiment(id: string): Promise<ApiResponse<void>> {
    const response = await request.post<ApiResponse<void>>(`/admin/experiments/${id}/enable`)
    return response
  },

  /**
   * 禁用指定的 A/B 测试实验
   * POST /admin/experiments/{id}/disable
   * @param id 实验ID
   * @returns 操作结果
   */
  async disableExperiment(id: string): Promise<ApiResponse<void>> {
    const response = await request.post<ApiResponse<void>>(`/admin/experiments/${id}/disable`)
    return response
  },

  /**
   * 标记实验为已完成状态
   * POST /admin/experiments/{id}/complete
   * @param id 实验ID
   * @returns 操作结果
   */
  async completeExperiment(id: string): Promise<ApiResponse<void>> {
    const response = await request.post<ApiResponse<void>>(`/admin/experiments/${id}/complete`)
    return response
  },

  /**
   * 评估推荐系统的召回质量
   * GET /admin/recall-quality/evaluate
   * @param params 评估参数（k值、天数、采样数量）
   * @returns 召回质量评估结果
   */
  async evaluateRecallQuality(
    params?: EvaluateRecallQualityParams,
  ): Promise<ApiResponse<RecallQualityEvaluationData>> {
    const response = await request.get<ApiResponse<RecallQualityEvaluationData>>(
      '/admin/recall-quality/evaluate',
      {
        params,
      },
    )
    return response
  },
}

export default experimentApi

