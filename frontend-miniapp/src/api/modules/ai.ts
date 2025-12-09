// @/api/modules/ai.ts
import request from '@/utils/request';
import type {
  AIRecommendRequest,
  AIRecommendData,
  RecommendFeedbackRequest,
  CreateAISessionRequest,
  SessionCreateData,
  ChatRequest,
  SuggestionData,
  HistoryData,
  ApiResponse,
} from '@/types/api';

/**
 * 获取AI推荐
 */
export const getAIRecommendation = (
  requestData: AIRecommendRequest
): Promise<ApiResponse<AIRecommendData>> => {
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
): Promise<ApiResponse<null>> => {
  return request<null>({
    url: '/ai/recommend/feedback',
    method: 'POST',
    data: feedbackData,
  });
};

/**
 * 创建新的对话会话
 */
export const createAISession = (
  payload: CreateAISessionRequest
): Promise<ApiResponse<SessionCreateData>> => {
  return request<SessionCreateData>({
    url: '/ai/sessions',
    method: 'POST',
    data: payload,
  });
};

/**
 * 流式对话（SSE）。返回值类型使用 string 占位（实际为 event-stream）。
 */
export const streamAIChat = (
  sessionId: string,
  payload: ChatRequest
): Promise<ApiResponse<string>> => {
  return request<string>({
    url: `/ai/sessions/${sessionId}/chat/stream`,
    method: 'POST',
    data: payload,
    header: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
  });
};

/**
 * 获取会话引导/快捷提示词
 */
export const getAISuggestions = (): Promise<ApiResponse<SuggestionData>> => {
  return request<SuggestionData>({
    url: '/ai/suggestions',
    method: 'GET',
  });
};

/**
 * 获取历史聊天记录
 */
export const getAIHistory = (
  sessionId: string,
  cursor?: string
): Promise<ApiResponse<HistoryData>> => {
  const query = cursor ? { cursor } : {};
  return request<HistoryData>({
    url: `/ai/sessions/${sessionId}/history`,
    method: 'GET',
    data: query,
  });
};