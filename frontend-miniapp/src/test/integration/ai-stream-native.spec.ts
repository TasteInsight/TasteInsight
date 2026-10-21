import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { streamAIChat } from '@/api/modules/ai';
import config from '@/config';
import { fetchTextStream } from '@/utils/fetch-text-stream';
import { useUserStore } from '@/store/modules/use-user-store';
import type { TextStreamOptions, TextStreamTransport } from '@/utils/text-stream';

jest.mock('@/config', () => ({ baseUrl: 'http://api.test', platform: 'app' }));
jest.mock('@/utils/fetch-text-stream', () => ({ fetchTextStream: jest.fn() }));
jest.mock('@/mock/mock-adapter', () => ({ mockInterceptor: async () => null }));

const storage = new Map<string, unknown>();
const nativeRequests: NativeRequest[] = [];
const jsonRequests: any[] = [];

class NativeRequest {
  readyState = 0;
  status = 0;
  responseText = '';
  timeout = 0;
  responseType = '';
  method = '';
  url = '';
  body = '';
  headers: Record<string, string> = {};
  onreadystatechange?: () => void;
  onprogress?: () => void;
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  onloadend?: () => void;
  abort = jest.fn(() => this.onabort?.());

  constructor() {
    nativeRequests.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: string) {
    this.body = body;
  }
  receive(status: number, text: string, complete = false) {
    this.status = status;
    this.responseText += text;
    this.readyState = complete ? 4 : 3;
    this.onreadystatechange?.();
    this.onprogress?.();
    if (complete) {
      this.onload?.();
      this.onloadend?.();
    }
  }
  fail(event: 'onerror' | 'ontimeout') {
    this.readyState = 4;
    this.onreadystatechange?.();
    this[event]?.();
    this.onloadend?.();
  }
}

class ViewRequest extends NativeRequest {
  private acceptedStatus = false;
  constructor(private options: TextStreamOptions) {
    super();
    this.open('POST', options.url);
    this.headers = options.header;
    this.send(options.body);
  }
  receive(status: number, text: string, complete = false) {
    if (!this.acceptedStatus) {
      this.acceptedStatus = true;
      this.options.onStatus(status);
    }
    if (status >= 200 && status < 300) {
      this.options.onText(text);
      if (complete) this.options.onComplete();
    }
  }
  fail() {
    this.options.onError(new Error('网络连接异常'));
  }
}

describe.each(['ios-xhr', 'android-view', 'h5-fetch'] as const)(
  '%s streaming transport',
  platform => {
    const transport: TextStreamTransport | undefined =
      platform === 'android-view' ? options => new ViewRequest(options) : undefined;
    const start = () => {
      const callbacks = {
        onEvent: jest.fn(),
        onMessage: jest.fn(),
        onJSON: jest.fn(),
        onError: jest.fn(),
        onComplete: jest.fn(),
      };
      return {
        handle: streamAIChat(
          'A-session',
          { message: '午餐', clientContext: { localTime: '12:00' } },
          callbacks,
          transport
        ),
        callbacks,
      };
    };

    beforeEach(() => {
      config.platform = platform === 'h5-fetch' ? 'h5' : 'app';
      (fetchTextStream as jest.Mock)
        .mockReset()
        .mockImplementation(options => new ViewRequest(options));
      storage.clear();
      storage.set('token', 'A-access');
      storage.set('refreshToken', 'A-refresh');
      storage.set('userInfo', JSON.stringify({ id: 'A', nickname: 'A' }));
      nativeRequests.length = 0;
      jsonRequests.length = 0;
      if (platform === 'h5-fetch') delete (globalThis as any).plus;
      else {
        (globalThis as any).plus = {
          os: { name: platform === 'ios-xhr' ? 'iOS' : 'Android' },
          net: { XMLHttpRequest: NativeRequest },
        };
      }
      (globalThis as any).uni = {
        getStorageSync: (key: string) => storage.get(key),
        setStorageSync: (key: string, value: unknown) => storage.set(key, value),
        removeStorageSync: (key: string) => storage.delete(key),
        request: jest.fn(options => {
          jsonRequests.push(options);
          return { abort: jest.fn() };
        }),
        showToast: jest.fn(),
      };
      setActivePinia(createPinia());
    });

    afterEach(() => {
      useUserStore().$dispose();
      delete (globalThis as any).plus;
    });

    test('streams response text once before completion', () => {
      const { callbacks } = start();
      const request = nativeRequests[0];
      expect(jsonRequests).toHaveLength(0);
      expect(request.headers.Authorization).toBe('Bearer A-access');
      expect(JSON.parse(request.body)).toEqual({
        message: '午餐',
        clientContext: { localTime: '12:00' },
      });
      request.receive(200, 'event: text_chunk\ndata: 午');
      expect(callbacks.onMessage).not.toHaveBeenCalled();
      request.receive(200, '餐🥢\n\n');
      expect(callbacks.onMessage.mock.calls).toEqual([['午餐🥢']]);
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      request.receive(200, 'event: reply_complete\ndata: {"messageId":"reply"}\n\n', true);
      expect(callbacks.onEvent.mock.calls).toEqual([['text_chunk'], ['reply_complete']]);
      expect(callbacks.onJSON).toHaveBeenCalledWith({ messageId: 'reply' });
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    });

    test('retries native HTTP 401 once with a fresh parser and rotated credential', async () => {
      const { callbacks } = start();
      nativeRequests[0].receive(401, '{"message":"expired"}', true);
      await flushPromises();
      expect(callbacks.onMessage).not.toHaveBeenCalled();
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      expect(jsonRequests).toHaveLength(1);
      expect(jsonRequests[0].url).toMatch(/\/auth\/refresh$/);
      jsonRequests[0].success({
        statusCode: 200,
        data: {
          code: 200,
          data: { token: { accessToken: 'A-new', refreshToken: 'A-refresh-new' } },
        },
      });
      await flushPromises();
      expect(nativeRequests).toHaveLength(2);
      expect(nativeRequests[1].headers.Authorization).toBe('Bearer A-new');
      nativeRequests[0].receive(200, 'event: text_chunk\ndata: old\n\n', true);
      nativeRequests[1].receive(401, '', true);
      expect(callbacks.onMessage).not.toHaveBeenCalled();
      expect(callbacks.onError).toHaveBeenCalledTimes(1);
      expect(callbacks.onError.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      expect(jsonRequests).toHaveLength(1);
      expect(useUserStore().isLoggedIn).toBe(false);
    });

    test('native SSE provider errors never rotate the application credential', () => {
      const { callbacks } = start();
      nativeRequests[0].receive(200, 'event: error\ndata: {"error":"provider HTTP 401"}\n\n', true);
      expect(callbacks.onError.mock.calls[0][0].message).toBe('provider HTTP 401');
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      expect(jsonRequests).toHaveLength(0);
      expect(useUserStore().token).toBe('A-access');
    });

    test.each(['onerror', 'ontimeout'] as const)(
      'native %s is terminal without false completion',
      event => {
        const { callbacks } = start();
        const request = nativeRequests[0];
        request.receive(200, 'event: text_chunk\ndata: 已收到\n\n');
        request.fail(event);
        request.receive(200, 'event: text_chunk\ndata: late\n\n', true);
        expect(callbacks.onMessage.mock.calls).toEqual([['已收到']]);
        expect(callbacks.onError).toHaveBeenCalledTimes(1);
        expect(callbacks.onComplete).not.toHaveBeenCalled();
      }
    );

    test('closing a native stream aborts the request and ignores late native events', () => {
      const { handle, callbacks } = start();
      handle.close();
      nativeRequests[0].receive(200, 'event: text_chunk\ndata: late\n\n', true);
      expect(nativeRequests[0].abort).toHaveBeenCalledTimes(1);
      expect(callbacks.onMessage).not.toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(callbacks.onComplete).not.toHaveBeenCalled();
    });

    test('native stream callbacks cannot cross an account change', () => {
      const { callbacks } = start();
      useUserStore().logoutAction();
      nativeRequests[0].receive(401, '', true);
      nativeRequests[0].fail('onerror');
      expect(jsonRequests).toHaveLength(0);
      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(callbacks.onComplete).not.toHaveBeenCalled();
    });

    test('parses CRLF events split across transport chunks before EOF', () => {
      const { callbacks } = start();
      nativeRequests[0].receive(200, 'event: text_chunk\r\ndata: 午餐🥢\r');
      expect(callbacks.onMessage).not.toHaveBeenCalled();
      nativeRequests[0].receive(200, '\n\r');
      nativeRequests[0].receive(200, '\n');
      expect(callbacks.onMessage.mock.calls).toEqual([['午餐🥢']]);
      expect(callbacks.onComplete).not.toHaveBeenCalled();
    });

    test('uses standard SSE framing for BOM, bare CR, comments and multiline text', () => {
      const { callbacks } = start();
      nativeRequests[0].receive(
        200,
        '\uFEFF: heartbeat\revent: text_chunk\rdata:  第一行\rdata: 第二行\r\r'
      );
      nativeRequests[0].receive(200, ': heartbeat\n');
      expect(callbacks.onMessage.mock.calls).toEqual([[' 第一行\n第二行']]);
      expect(callbacks.onComplete).not.toHaveBeenCalled();
    });

    test('EOF discards an incomplete completion event', () => {
      const { callbacks } = start();
      nativeRequests[0].receive(200, 'event: text_chunk\ndata: 已收到\n\n');
      nativeRequests[0].receive(
        200,
        'event: reply_complete\ndata: {"messageId":"unfinished"}',
        true
      );
      expect(callbacks.onEvent.mock.calls).toEqual([['text_chunk']]);
      expect(callbacks.onMessage.mock.calls).toEqual([['已收到']]);
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    });
  }
);
