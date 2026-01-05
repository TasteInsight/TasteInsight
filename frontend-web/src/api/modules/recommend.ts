import request from '@/utils/request'
import type {
  ApiResponse,
  GetRecommendRequest,
  GetRecommendResponseData,
  GetSimilarRecommendRequest,
  SimilarRecommendResponseData,
  GetPersonalRecommendRequest,
  ClickEventRequest,
  FavoriteEventRequest,
  ReviewEventRequest,
  DislikeEventRequest,
  EventResponseData,
  EventChainResponseData,
  GetFunnelAnalyticsParams,
  FunnelAnalyticsResponseData,
  ExperimentGroupResponseData,
  RecommendHealthResponseData,
} from '@/types/api'

/**
 * 推荐系统相关 API
 */
export const recommendApi = {
  /**
   * 获取个性化推荐
   * POST /recommend
   * @param params 推荐请求参数
   * @returns 推荐结果列表（包含 meta、requestId、debug 等信息）
   */
  async getRecommend(
    params: GetRecommendRequest,
  ): Promise<ApiResponse<GetRecommendResponseData>> {
    const response = await request.post<ApiResponse<GetRecommendResponseData>>(
      '/recommend',
      params,
    )
    return response
  },

  /**
   * 获取相似菜品推荐
   * POST /recommend/similar/{dishId}
   * @param dishId 菜品ID
   * @param params 分页参数
   * @returns 相似菜品推荐列表
   */
  async getSimilarRecommend(
    dishId: string,
    params: GetSimilarRecommendRequest,
  ): Promise<ApiResponse<SimilarRecommendResponseData>> {
    const response = await request.post<ApiResponse<SimilarRecommendResponseData>>(
      `/recommend/similar/${dishId}`,
      params,
    )
    return response
  },

  /**
   * 获取基于嵌入的个性化推荐
   * POST /recommend/personal
   * @param params 推荐请求参数
   * @returns 个性化推荐列表
   */
  async getPersonalRecommend(
    params: GetPersonalRecommendRequest,
  ): Promise<ApiResponse<SimilarRecommendResponseData>> {
    const response = await request.post<ApiResponse<SimilarRecommendResponseData>>(
      '/recommend/personal',
      params,
    )
    return response
  },

  /**
   * 记录点击事件
   * @param params 点击事件参数
   * @returns 事件记录结果
   */
  async recordClickEvent(params: ClickEventRequest): Promise<ApiResponse<EventResponseData>> {
    const response = await request.post<ApiResponse<EventResponseData>>(
      '/recommend/events/click',
      params,
    )
    return response
  },

  /**
   * 记录收藏事件
   * @param params 收藏事件参数
   * @returns 事件记录结果
   */
  async recordFavoriteEvent(
    params: FavoriteEventRequest,
  ): Promise<ApiResponse<EventResponseData>> {
    const response = await request.post<ApiResponse<EventResponseData>>(
      '/recommend/events/favorite',
      params,
    )
    return response
  },

  /**
   * 记录评价事件
   * @param params 评价事件参数
   * @returns 事件记录结果
   */
  async recordReviewEvent(params: ReviewEventRequest): Promise<ApiResponse<EventResponseData>> {
    const response = await request.post<ApiResponse<EventResponseData>>(
      '/recommend/events/review',
      params,
    )
    return response
  },

  /**
   * 记录负反馈事件
   * @param params 负反馈事件参数
   * @returns 事件记录结果
   */
  async recordDislikeEvent(
    params: DislikeEventRequest,
  ): Promise<ApiResponse<EventResponseData>> {
    const response = await request.post<ApiResponse<EventResponseData>>(
      '/recommend/events/dislike',
      params,
    )
    return response
  },

  /**
   * 获取推荐请求的事件链
   * GET /recommend/events/chain/{requestId}
   * @param requestId 推荐请求ID
   * @returns 推荐请求的完整用户行为路径
   */
  async getEventChain(
    requestId: string,
  ): Promise<ApiResponse<EventChainResponseData>> {
    const response = await request.get<ApiResponse<EventChainResponseData>>(
      `/recommend/events/chain/${requestId}`,
    )
    return response
  },

  /**
   * 获取用户行为漏斗数据
   * GET /recommend/analytics/funnel
   * @param params 查询参数（统计天数）
   * @returns 用户行为漏斗数据
   */
  async getFunnelAnalytics(
    params?: GetFunnelAnalyticsParams,
  ): Promise<ApiResponse<FunnelAnalyticsResponseData>> {
    const response = await request.get<ApiResponse<FunnelAnalyticsResponseData>>(
      '/recommend/analytics/funnel',
      {
        params,
      },
    )
    return response
  },

  /**
   * 获取用户当前的实验分组
   * GET /recommend/experiment/{experimentId}/group
   * @param experimentId 实验ID
   * @returns 用户在指定 A/B 测试实验中的分组信息
   */
  async getExperimentGroup(
    experimentId: string,
  ): Promise<ApiResponse<ExperimentGroupResponseData>> {
    const response = await request.get<ApiResponse<ExperimentGroupResponseData>>(
      `/recommend/experiment/${experimentId}/group`,
    )
    return response
  },

  /**
   * 获取推荐系统健康状态
   * GET /recommend/health
   * @returns 推荐系统各组件的运行状态
   */
  async getHealth(): Promise<ApiResponse<RecommendHealthResponseData>> {
    const response = await request.get<ApiResponse<RecommendHealthResponseData>>(
      '/recommend/health',
    )
    return response
  },
}

export default recommendApi

