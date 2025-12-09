// @/api/modules/ai.ts
import request from '@/utils/request';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
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
  AIStreamCallbacks, // 确保这个类型在 types/api.d.ts 中已定义
} from '@/types/api';

/**
 * 获取AI推荐 (保持不变)
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
 * 提交推荐反馈 (保持不变)
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
 * 创建新的对话会话 (保持不变)
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
 * 获取会话引导/快捷提示词 (保持不变)
 */
export const getAISuggestions = (): Promise<ApiResponse<SuggestionData>> => {
  return request<SuggestionData>({
    url: '/ai/suggestions',
    method: 'GET',
  });
};

/**
 * 获取历史聊天记录 (保持不变)
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

// ==================== 核心逻辑抽离：解析 SSE 字符串 ====================

/**
 * 解析单行 SSE 字符串
 * 处理粘包、多行 event/data 的情况
 */
function parseSSEEventString(evtString: string, callbacks: AIStreamCallbacks) {
  // 有些 evtString 可能包含多个 data: 行，或者 event: 行
  // 标准 SSE 格式是以 \n\n 分隔事件，这里的 evtString 应该是已经被 \n\n 切分过的一个完整块（或者不完整的块，但在外部处理了）
  // 简单起见，这里假设 evtString 是一个或多个以 \n 分隔的行
  
  let eventName: string | undefined;
  let dataLines: string[] = [];
  const lines = evtString.split('\n');
  
  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine) continue; // 跳过空行

    if (trimLine.startsWith('event:')) {
      eventName = trimLine.replace('event:', '').trim();
      callbacks.onEvent?.(eventName);
    } else if (trimLine.startsWith('data:')) {
      dataLines.push(trimLine.replace('data:', '').trim());
    }
  }
  
  if (dataLines.length > 0) {
    const dataStr = dataLines.join('\n');
    callbacks.onMessage?.(dataStr);
    try {
      const json = JSON.parse(dataStr);
      callbacks.onJSON?.(json);
    } catch (e) {
      // ignore non-json data (e.g. simple text)
    }
  }
}

// ==================== HTTP Chunked 实现 (UniApp/小程序/App通用) ====================

/**
 * HTTP Chunked 流式对话
 * 适用于：微信小程序、UniApp (Android/iOS App)、H5 (uni.request 内部封装了 xhr/fetch)
 */
export const streamAIChat = (
  sessionId: string,
  payload: ChatRequest,
  callbacks: AIStreamCallbacks = {}
) => {
  const url = `${config.baseUrl}/ai/sessions/${sessionId}/chat/stream`;
  const userStore = useUserStore();

  // 1. 构造 Header (需要手动携带 Token，因为不走 request.ts 拦截器)
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  if (userStore.token) {
    header['Authorization'] = `Bearer ${userStore.token}`;
  }

  // 2. 发起分块请求
  const requestTask = uni.request({
    url,
    method: 'POST',
    header,
    data: payload,
    enableChunked: true, // 【核心】：开启分块传输
    timeout: 60000,      // 建议设置长超时（如60秒），防止AI思考时间过长导致断开
    success: (res) => {
      // 这里的 success 是指整个请求连接结束（或握手成功），并不代表数据接收完毕
      // 通常在流结束后触发，视平台实现而定
    },
    fail: (err) => {
      callbacks.onError?.(err);
    },
    complete: () => {
      // 处理最后剩余的未完成 UTF-8 字节
      const remaining = decoder.decode();
      if (remaining) {
        buffer += remaining;
      }
      // 处理剩余的 buffer
      if (buffer) {
        const events = buffer.split('\n\n');
        for (const evt of events) {
          if (evt.trim()) {
            parseSSEEventString(evt, callbacks);
          }
        }
      }
      callbacks.onComplete?.();
    }
  });

  // 3. 处理分块数据
  // TextDecoder 兼容性处理
  // 在微信小程序基础库 2.11.0+ 支持 TextDecoder
  // 如果在某些旧版 App 环境不支持，可能需要引入 polyfill 或使用简易实现
  // 这里假设环境支持 TextDecoder (HBuilderX 3.x+ 内置的 App 环境通常支持)
  const decoder = new TextDecoder('utf-8'); 
  let buffer = '';

  // @ts-ignore: uni.request 返回的 requestTask 在 TS 定义中可能缺少 onChunkReceived
  requestTask.onChunkReceived((response: { data: ArrayBuffer }) => {
    if (response && response.data) {
      // 解码二进制数据
      const chunk = decoder.decode(response.data, { stream: true });
      buffer += chunk;
      
      // 按双换行符切割 SSE 事件
      const events = buffer.split('\n\n');
      
      // 最后一个元素可能是不完整的（粘包），留到下一次处理
      buffer = events.pop() || '';

      for (const evt of events) {
         parseSSEEventString(evt, callbacks);
      }
    }
  });

  // 返回控制句柄，允许外部中断请求
  return {
    close: () => requestTask.abort()
  };
};