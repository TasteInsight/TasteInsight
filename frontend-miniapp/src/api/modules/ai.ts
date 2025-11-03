// @/api/modules/ai.ts
import request from '@/utils/request';
import type {
  AIRecommendRequest,
  AIRecommendData,
  RecommendFeedbackRequest,
} from '@/types/api';

/**
 * 获取AI推荐
 */
export const getAIRecommendation = (
  requestData: AIRecommendRequest
): Promise<AIRecommendData> => {
  return request<AIRecommendData>({
    url: '/ai/recommend',
    method: 'POST',
    data: requestData,
  });
};

/**
 * 提交推荐反馈
 */
export const submitRecommendFeedback = (
  feedbackData: RecommendFeedbackRequest
): Promise<null> => {
  return request<null>({
    url: '/ai/recommend/feedback',
    method: 'POST',
    data: feedbackData,
  });
};