import { t, locale } from '@/i18n';
// @/api/modules/ai.ts
import request from '@/utils/request';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { expireSession, refreshAccessToken } from '@/utils/auth-session';
import { createHttpError } from '@/utils/user-friendly-error';
import type { TextStreamTransport } from '@/utils/text-stream';
import { fetchTextStream } from '@/utils/fetch-text-stream';
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

function dispatchAIEvent(event: EventSourceMessage, callbacks: AIStreamCallbacks) {
  callbacks.onEvent?.(event.event || 'message');
  let json: any;
  try {
    json = JSON.parse(event.data);
  } catch {
    // text_chunk 的正文为纯文本。
  }
  if (event.event === 'error') {
    const message =
      (json && typeof json.error === 'string' && json.error) ||
      (json && typeof json.message === 'string' && json.message) ||
      event.data ||
      t('common.errors.aiStream');
    callbacks.onError?.(new Error(message));
    return;
  }
  callbacks.onMessage?.(event.data);
  if (json !== undefined) callbacks.onJSON?.(json);
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

/**
 * SSE 解析与鉴权共用同一流程；传输层负责交付增量文本和 HTTP 状态。
 */
export const streamAIChat = (
  sessionId: string,
  payload: ChatRequest,
  callbacks: AIStreamCallbacks = {},
  transport?: TextStreamTransport
) => {
  const streamTransport = transport ?? (config.platform === 'h5' ? fetchTextStream : undefined);
  const url = `${config.baseUrl}/ai/sessions/${sessionId}/chat/stream`;
  const userStore = useUserStore();
  const sessionVersion = userStore.sessionVersion;
  const requestLocale = locale.value;
  let isAborted = false;
  let terminalState: 'pending' | 'error' | 'complete' = 'pending';
  let activeAttempt: object | null = null;
  let requestTask: Pick<UniApp.RequestTask, 'abort'> | undefined;
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
      'Accept-Language': requestLocale,
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
    const parser = createParser({ onEvent: event => dispatchAIEvent(event, guardedCallbacks) });
    const consumeChunk = (data: ArrayBuffer | string) => {
      if (!isCurrentAttempt() || !data) return;
      parser.feed(typeof data === 'string' ? data : streamDecoder.decode(data));
    };
    const acceptResponse = (statusCode: number, data?: unknown) => {
      if (!isCurrentAttempt()) return false;
      if (statusCode === 401) {
        if (retried || deliveredEvent) {
          failAuthentication(createHttpError(401));
        } else {
          // 401 在业务处理前被拒绝；仅此情形允许轮换凭据后重试一次。
          activeAttempt = null;
          void recoverAuthentication(accessToken);
        }
        return false;
      }
      if (statusCode < 200 || statusCode >= 300) {
        finishWithError(createHttpError(statusCode, data));
        return false;
      }
      return true;
    };
    const failAttempt = (error: unknown) => {
      if (isCurrentAttempt()) finishWithError(error);
    };
    const completeAttempt = () => {
      if (!isCurrentAttempt()) return;
      parser.feed(streamDecoder.flush());
      parser.reset();
      if (!isCurrentAttempt()) return;
      terminalState = 'complete';
      callbacks.onComplete?.();
    };

    if (streamTransport) {
      requestTask = streamTransport({
        url,
        header,
        body: JSON.stringify(payload),
        onStatus: acceptResponse,
        onText: consumeChunk,
        onError: failAttempt,
        onComplete: completeAttempt,
      });
      return;
    }

    // #ifdef APP-PLUS
    const NativeRequest = typeof plus === 'undefined' ? undefined : plus.net?.XMLHttpRequest;
    if (NativeRequest) {
      const xhr = new NativeRequest();
      requestTask = xhr;
      let receivedLength = 0;
      const readResponse = () => {
        if (!isCurrentAttempt() || !xhr.status || xhr.status < 200 || xhr.status >= 300) return;
        const text = xhr.responseText || '';
        const chunk = text.slice(receivedLength);
        receivedLength = text.length;
        consumeChunk(chunk);
      };
      xhr.open('POST', url);
      xhr.responseType = 'text';
      xhr.timeout = 60000;
      for (const [name, value] of Object.entries(header)) xhr.setRequestHeader(name, value);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3) readResponse();
      };
      xhr.onprogress = readResponse;
      xhr.onload = () => {
        if (!acceptResponse(xhr.status || 0, xhr.responseText)) return;
        readResponse();
        completeAttempt();
      };
      xhr.onerror = () => failAttempt(new Error(t('common.errors.networkRetry')));
      xhr.ontimeout = () => failAttempt(new Error(t('common.errors.timeout')));
      xhr.send(JSON.stringify(payload));
      return;
    }
    // #endif

    const task = uni.request({
      url,
      method: 'POST',
      header,
      data: payload,
      enableChunked: true,
      responseType: 'arraybuffer',
      timeout: 60000,
      success: res => {
        acceptResponse(res.statusCode, res.data);
      },
      fail: failAttempt,
      complete: completeAttempt,
    }) as UniApp.RequestTask & {
      onChunkReceived(callback: (response: { data: ArrayBuffer | string }) => void): void;
    };
    requestTask = task;

    task.onChunkReceived(response => {
      if (response?.data) consumeChunk(response.data);
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
