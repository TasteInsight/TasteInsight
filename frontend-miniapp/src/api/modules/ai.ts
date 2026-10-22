// @/api/modules/ai.ts
import request from '@/utils/request';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { expireSession, refreshAccessToken } from '@/utils/auth-session';
import { createHttpError } from '@/utils/user-friendly-error';
import type {
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
 * 提交推荐反馈。反馈属于推荐域，不属于 AI 会话域。
 */
export const submitRecommendFeedback = (
  feedbackData: RecommendFeedbackRequest
): Promise<ApiResponse<{ eventId: string | null }>> => {
  return request<{ eventId: string | null }>({
    url: `/recommend/events/${feedbackData.feedback}`,
    method: 'POST',
    data: { dishId: feedbackData.dishId },
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
 * 获取会话引导/快捷提示词
 * @param clientContext 客户端上下文，包含本地时间信息
 */
export const getAISuggestions = (clientContext?: {
  localTime?: string;
  timeZone?: string;
  tzOffsetMinutes?: number;
}): Promise<ApiResponse<SuggestionData>> => {
  const params: Record<string, string> = {};
  if (clientContext?.localTime) {
    params.localTime = clientContext.localTime;
  }
  if (clientContext?.timeZone) {
    params.timeZone = clientContext.timeZone;
  }
  if (clientContext?.tzOffsetMinutes !== undefined) {
    params.tzOffsetMinutes = String(clientContext.tzOffsetMinutes);
  }

  return request<SuggestionData>({
    url: '/ai/suggestions',
    method: 'GET',
    data: params,
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

/**
 * 删除聊天会话
 */
export const deleteAISession = (sessionId: string): Promise<ApiResponse<null>> => {
  return request<null>({
    url: `/ai/sessions/${sessionId}`,
    method: 'DELETE',
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
  const dataLines: string[] = [];
  const lines = evtString.split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
    // SSE 规范只移除冒号后的一个可选空格；其余空白属于数据本身。
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') {
      eventName = value;
      callbacks.onEvent?.(eventName);
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length > 0) {
    const dataStr = dataLines.join('\n');
    let json: any;
    try {
      json = JSON.parse(dataStr);
    } catch (e) {
      // ignore non-json data (e.g. simple text)
    }

    if (eventName === 'error') {
      const message =
        (json && typeof json.error === 'string' && json.error) ||
        (json && typeof json.message === 'string' && json.message) ||
        dataStr ||
        'AI 流式请求失败';
      callbacks.onError?.(new Error(message));
      return;
    }

    callbacks.onMessage?.(dataStr);
    if (json !== undefined) {
      callbacks.onJSON?.(json);
    }
  }
}

type StreamDecoder = {
  decode: (data: ArrayBuffer) => string;
  flush: () => string;
};

function createUtf8StreamDecoder(): StreamDecoder {
  let pending: number[] = [];

  const decode = (data: ArrayBuffer): string => {
    const incoming = new Uint8Array(data);
    const bytes = pending.length ? new Uint8Array(pending.length + incoming.length) : incoming;
    if (pending.length) {
      bytes.set(pending, 0);
      bytes.set(incoming, pending.length);
      pending = [];
    }

    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b0 = bytes[i];
      if (b0 <= 0x7f) {
        out += String.fromCharCode(b0);
        i += 1;
        continue;
      }

      let needed = 0;
      let codePoint = 0;

      if (b0 >= 0xc2 && b0 <= 0xdf) {
        needed = 2;
        codePoint = b0 & 0x1f;
      } else if (b0 >= 0xe0 && b0 <= 0xef) {
        needed = 3;
        codePoint = b0 & 0x0f;
      } else if (b0 >= 0xf0 && b0 <= 0xf4) {
        needed = 4;
        codePoint = b0 & 0x07;
      } else {
        out += '\uFFFD';
        i += 1;
        continue;
      }

      if (i + needed > bytes.length) {
        pending = Array.from(bytes.slice(i));
        break;
      }

      let valid = true;
      for (let k = 1; k < needed; k++) {
        const bx = bytes[i + k];
        if ((bx & 0xc0) !== 0x80) {
          valid = false;
          break;
        }
        codePoint = (codePoint << 6) | (bx & 0x3f);
      }

      if (!valid) {
        out += '\uFFFD';
        i += 1;
        continue;
      }

      // Reject overlong encodings and invalid ranges
      if (
        (needed === 2 && codePoint < 0x80) ||
        (needed === 3 && codePoint < 0x800) ||
        (needed === 4 && codePoint < 0x10000) ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
        codePoint > 0x10ffff
      ) {
        out += '\uFFFD';
        i += needed;
        continue;
      }

      if (codePoint <= 0xffff) {
        out += String.fromCharCode(codePoint);
      } else {
        const cp = codePoint - 0x10000;
        const hi = 0xd800 + (cp >> 10);
        const lo = 0xdc00 + (cp & 0x3ff);
        out += String.fromCharCode(hi, lo);
      }
      i += needed;
    }

    return out;
  };

  const flush = (): string => {
    if (!pending.length) return '';
    pending = [];
    return '\uFFFD';
  };

  return { decode, flush };
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
  const sessionVersion = userStore.sessionVersion;
  let isAborted = false;
  let terminalState: 'pending' | 'error' | 'complete' = 'pending';
  let activeAttempt: object | null = null;
  let requestTask: UniApp.RequestTask | undefined;
  const isCurrentStream = () =>
    !isAborted && terminalState === 'pending' && userStore.sessionVersion === sessionVersion;

  const finishWithError = (error: unknown) => {
    if (!isCurrentStream()) return;
    terminalState = 'error';
    callbacks.onError?.(error);
  };
  const failAuthentication = (error: any) => {
    if (!isCurrentStream()) return;
    finishWithError(error);
    if (error?.statusCode === 401) expireSession(sessionVersion);
  };
  const recoverAuthentication = async (accessToken: string | null) => {
    try {
      await refreshAccessToken(sessionVersion, accessToken);
      if (isCurrentStream()) send(true);
    } catch (error) {
      failAuthentication(error);
    }
  };

  function send(retried = false) {
    const attempt = {};
    activeAttempt = attempt;
    const isCurrentAttempt = () => isCurrentStream() && activeAttempt === attempt;
    const accessToken = userStore.token;
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (accessToken) header.Authorization = `Bearer ${accessToken}`;
    let deliveredEvent = false;
    const guardedCallbacks: AIStreamCallbacks = {
      onEvent: event => {
        if (!isCurrentAttempt()) return;
        deliveredEvent = true;
        callbacks.onEvent?.(event);
      },
      onMessage: message => {
        if (!isCurrentAttempt()) return;
        deliveredEvent = true;
        callbacks.onMessage?.(message);
      },
      onJSON: json => {
        if (isCurrentAttempt()) callbacks.onJSON?.(json);
      },
      onError: error => {
        if (isCurrentAttempt()) finishWithError(error);
      },
    };
    // 每次 HTTP 尝试独立解码，旧请求的残留数据随该次尝试结束。
    const streamDecoder: StreamDecoder =
      typeof TextDecoder !== 'undefined'
        ? (() => {
            const decoder = new TextDecoder('utf-8');
            return {
              decode: (data: ArrayBuffer) => decoder.decode(data, { stream: true }),
              flush: () => decoder.decode(),
            };
          })()
        : createUtf8StreamDecoder();
    let buffer = '';

    const task = uni.request({
      url,
      method: 'POST',
      header,
      data: payload,
      enableChunked: true,
      responseType: 'arraybuffer',
      timeout: 60000,
      success: res => {
        if (!isCurrentAttempt()) return;
        if (res.statusCode === 401) {
          if (retried || deliveredEvent) {
            failAuthentication(createHttpError(401));
          } else {
            // 401 在业务处理前被拒绝；仅此情形允许轮换凭据后重试一次。
            activeAttempt = null;
            void recoverAuthentication(accessToken);
          }
        } else if (res.statusCode < 200 || res.statusCode >= 300) {
          finishWithError(createHttpError(res.statusCode, res.data));
        }
      },
      fail: error => {
        if (isCurrentAttempt()) finishWithError(error);
      },
      complete: () => {
        if (!isCurrentAttempt()) return;
        buffer += streamDecoder.flush();
        for (const event of buffer.split('\n\n')) {
          if (event.trim()) parseSSEEventString(event, guardedCallbacks);
        }
        if (!isCurrentAttempt()) return;
        terminalState = 'complete';
        callbacks.onComplete?.();
      },
    }) as UniApp.RequestTask & {
      onChunkReceived(callback: (response: { data: ArrayBuffer | string }) => void): void;
    };
    requestTask = task;

    task.onChunkReceived(response => {
      if (!isCurrentAttempt() || !response?.data) return;
      buffer +=
        typeof response.data === 'string' ? response.data : streamDecoder.decode(response.data);
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) parseSSEEventString(event, guardedCallbacks);
    });
  }

  send();
  return {
    close: () => {
      isAborted = true;
      activeAttempt = null;
      try {
        requestTask?.abort();
      } catch (error) {
        console.error('[streamAIChat] Error aborting request:', error);
      }
    },
  };
};
