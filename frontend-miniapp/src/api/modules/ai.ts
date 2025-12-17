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
  // 注意：对于 enableChunked: true 的流式请求，success/fail/complete 回调的行为可能不一致
  // - success: 可能在连接建立时触发，不代表数据传输完成
  // - fail: 可能在连接失败时触发，但流式传输中的错误可能不触发此回调
  // - complete: 在连接关闭时触发，可用于清理资源
  // 主要错误处理应通过 onChunkReceived 中的异常或超时机制实现
  const requestTask = uni.request({
    url,
    method: 'POST',
    header,
    data: payload,
    enableChunked: true, // 【核心】：开启分块传输
    timeout: 60000,      // 建议设置长超时（如60秒），防止AI思考时间过长导致断开
    success: (res) => {
      // 对于流式请求，此回调可能仅表示连接握手成功，不代表数据接收完毕
      // 不在这里处理业务逻辑
    },
    fail: (err) => {
      // 注意：流式传输中的网络错误可能不会触发此回调
      // 主要依赖 complete 回调和外部超时机制处理错误
      callbacks.onError?.(err);
    },
    complete: () => {
      // 处理最后剩余的未完成 UTF-8 字节（仅当支持 TextDecoder 时）
      if (decoder) {
        const remaining = decoder.decode();
        if (remaining) {
          buffer += remaining;
        }
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
  // 兼容性处理：如果环境支持 TextDecoder，则使用，否则使用简易 fallback
  let decoder: TextDecoder | null = null;
  let decodeChunk: (data: ArrayBuffer) => string;
  if (typeof TextDecoder !== 'undefined') {
    decoder = new TextDecoder('utf-8');
    decodeChunk = (data: ArrayBuffer) => decoder!.decode(data, { stream: true });
  } else {
    // 简易 fallback: 仅适用于基本 UTF-8/ASCII，复杂字符可能有问题
    decodeChunk = (data: ArrayBuffer) => {
      const uint8Array = new Uint8Array(data);
      let result = '';
      for (let i = 0; i < uint8Array.length; i++) {
        result += String.fromCharCode(uint8Array[i]);
      }
      return result;
    };
  }
  let buffer = '';

  // @ts-ignore: uni.request 返回的 requestTask 在 TS 定义中可能缺少 onChunkReceived
  requestTask.onChunkReceived((response: { data: ArrayBuffer }) => {
    if (response && response.data) {
      // 解码二进制数据
      const chunk = decodeChunk(response.data);
      buffer += chunk;
      
      // 按双换行符切割 SSE 事件
      const events = buffer.split('\n\n');
      
      // 最后一个元素可能是不完整的（粘包），留到下一次处理
      if (buffer.endsWith('\n\n')) {
        buffer = '';
      } else {
        buffer = events.pop() || '';
      }

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