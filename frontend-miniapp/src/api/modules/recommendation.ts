// @/api/modules/recommendation.ts
import request from '@/utils/request';
import type {
  ApiResponse,
  RecommendationRequest,
  RecommendationResponseData,
  RecommendationClickEvent,
  RecommendationClickEventResponse,
} from '@/types/api';

/**
 * 推荐场景枚举
 */
export enum RecommendationScene {
  HOME = 'home',
  SEARCH = 'search',
  SIMILAR = 'similar',
  GUESS_LIKE = 'guess_like',
  TODAY = 'today',
}

/**
 * 获取个性化推荐
 */
export const getRecommendations = (
  params: RecommendationRequest
): Promise<ApiResponse<RecommendationResponseData>> => {
  return request<RecommendationResponseData>({
    url: '/recommend',
    method: 'POST',
    data: params,
  });
};

/**
 * 记录点击事件
 */
export const logClickEvent = (
  data: RecommendationClickEvent
): Promise<ApiResponse<RecommendationClickEventResponse>> => {
  return request<RecommendationClickEventResponse>({
    url: '/recommend/events/click',
    method: 'POST',
    data,
  });
};
