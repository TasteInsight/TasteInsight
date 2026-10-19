import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { streamAIChat } from '@/api/modules/ai';
import { useUserStore } from '@/store/modules/use-user-store';
import request from '@/utils/request';

jest.mock('@/config', () => ({ baseUrl: 'http://api.test' }));
jest.mock('@/mock/mock-adapter', () => ({ mockInterceptor: async () => null }));

const storage = new Map<string, any>();
const requests: any[] = [];
const streams = () => requests.filter(item => item.options.enableChunked);
const refreshes = () => requests.filter(item => item.options.url.endsWith('/auth/refresh'));
const ok = (data: unknown) => ({ statusCode: 200, data: { code: 200, data } });
const respond = (task: any, statusCode: number, data = {}) => {
  task.options.success({ statusCode, data });
  task.options.complete?.();
};
const rotate = () => {
  const task = refreshes().at(-1);
  task.options.success(ok({ token: { accessToken: 'A-new', refreshToken: 'A-refresh-new' } }));
};
const start = () => {
  const callbacks = {
    onMessage: jest.fn(),
    onJSON: jest.fn(),
    onError: jest.fn(),
    onComplete: jest.fn(),
  };
  return {
    handle: streamAIChat(
      'A-session',
      { message: '午餐', clientContext: { localTime: '12:00' } },
      callbacks
    ),
    callbacks,
  };
};

beforeEach(() => {
  storage.clear();
  storage.set('token', 'A-access');
  storage.set('refreshToken', 'A-refresh');
  storage.set('userInfo', JSON.stringify({ id: 'A', nickname: 'A' }));
  requests.length = 0;
  (globalThis as any).uni = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: any) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    request: jest.fn(options => {
      const task = { options, chunk: (_data: any) => {}, abort: jest.fn() };
      requests.push(task);
      return {
        onChunkReceived: (callback: any) => {
          task.chunk = callback;
        },
        abort: task.abort,
      };
    }),
    reLaunch: jest.fn(),
    showToast: jest.fn(),
  };
  setActivePinia(createPinia());
});

afterEach(() => useUserStore().$dispose());

test('retries one unauthorized stream with the rotated token and ignores the previous attempt', async () => {
  const { callbacks } = start();
  const original = streams()[0];
  respond(original, 401);
  await flushPromises();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(refreshes()).toHaveLength(1);
  expect(refreshes()[0].options.header.Authorization).toBe('Bearer A-refresh');
  rotate();
  await flushPromises();
  expect(streams()).toHaveLength(2);
  expect(streams()[1].options.header.Authorization).toBe('Bearer A-new');
  expect(streams()[1].options.data).toEqual(original.options.data);
  original.chunk({ data: 'event: text_chunk\ndata: obsolete\n\n' });
  respond(original, 401);
  streams()[1].chunk({ data: 'event: text_chunk\ndata: 正常回复\n\n' });
  respond(streams()[1], 200);
  expect(callbacks.onMessage.mock.calls).toEqual([['正常回复']]);
  expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(useUserStore().isLoggedIn).toBe(true);
});

test('shares token rotation with a concurrent JSON request', async () => {
  const { callbacks } = start();
  const read = request({ url: '/user/profile' });
  await flushPromises();
  const jsonTask = requests.find(item => !item.options.enableChunked);
  respond(jsonTask, 401);
  respond(streams()[0], 401);
  await flushPromises();
  expect(refreshes()).toHaveLength(1);
  rotate();
  await flushPromises();
  expect(streams()).toHaveLength(2);
  const retry = requests.filter(item => item.options.url.endsWith('/user/profile')).at(-1);
  expect(retry.options.header.Authorization).toBe('Bearer A-new');
  respond(retry, 200, { code: 200, data: { id: 'A' } });
  await expect(read).resolves.toMatchObject({ data: { id: 'A' } });
  respond(streams()[1], 200);
  expect(callbacks.onError).not.toHaveBeenCalled();
});

test('expires the current session when no refresh credential remains', async () => {
  useUserStore().refreshToken = null;
  const { callbacks } = start();
  respond(streams()[0], 401);
  await flushPromises();
  expect(useUserStore().isLoggedIn).toBe(false);
  expect(storage.has('token')).toBe(false);
  expect(refreshes()).toHaveLength(0);
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(callbacks.onError.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(uni.reLaunch).not.toHaveBeenCalled();
});

test.each([401, 503, 'network'])(
  'handles refresh failure %s without treating a transient failure as logout',
  async failure => {
    const { callbacks } = start();
    respond(streams()[0], 401);
    await flushPromises();
    expect(refreshes()).toHaveLength(1);
    if (failure === 'network') refreshes()[0].options.fail({ errMsg: 'offline' });
    else respond(refreshes()[0], failure as number);
    await flushPromises();
    expect(useUserStore().isLoggedIn).toBe(failure !== 401);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(streams()).toHaveLength(1);
  }
);

test('expires the session after the single retry is also unauthorized', async () => {
  const { callbacks } = start();
  respond(streams()[0], 401);
  await flushPromises();
  expect(refreshes()).toHaveLength(1);
  rotate();
  await flushPromises();
  expect(streams()).toHaveLength(2);
  respond(streams()[1], 401);
  await flushPromises();
  expect(refreshes()).toHaveLength(1);
  expect(streams()).toHaveLength(2);
  expect(useUserStore().isLoggedIn).toBe(false);
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
});

test('closing while refresh is pending prevents replay and callbacks', async () => {
  const { handle, callbacks } = start();
  respond(streams()[0], 401);
  await flushPromises();
  expect(refreshes()).toHaveLength(1);
  handle.close();
  rotate();
  await flushPromises();
  expect(streams()).toHaveLength(1);
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
});

test('a late refresh cannot replay the old conversation or expire a new account', async () => {
  const { callbacks } = start();
  respond(streams()[0], 401);
  await flushPromises();
  expect(refreshes()).toHaveLength(1);
  const user = useUserStore();
  user.logoutAction();
  user.token = 'B-access';
  user.refreshToken = 'B-refresh';
  user.userInfo = { id: 'B' } as any;
  rotate();
  await flushPromises();
  expect(streams()).toHaveLength(1);
  expect(user.token).toBe('B-access');
  expect(user.refreshToken).toBe('B-refresh');
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
});

test('uses an already rotated token without starting another refresh', async () => {
  start();
  useUserStore().updateTokens(useUserStore().sessionVersion, 'A-new', 'A-refresh-new');
  respond(streams()[0], 401);
  await flushPromises();
  expect(refreshes()).toHaveLength(0);
  expect(streams()).toHaveLength(2);
  expect(streams()[1].options.header.Authorization).toBe('Bearer A-new');
});

test('a response that already delivered an event is never automatically replayed', async () => {
  const { callbacks } = start();
  streams()[0].chunk({ data: 'event: message_received\ndata: {"messageId":"stored"}\n\n' });
  respond(streams()[0], 401);
  await flushPromises();
  expect(streams()).toHaveLength(1);
  expect(refreshes()).toHaveLength(0);
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
});

test('a provider error carried inside HTTP 200 never refreshes or expires user credentials', () => {
  const { callbacks } = start();
  streams()[0].chunk({ data: 'event: error\ndata: {"error":"provider HTTP 401"}\n\n' });
  respond(streams()[0], 200);
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(callbacks.onError.mock.calls[0][0].message).toBe('provider HTTP 401');
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(useUserStore().token).toBe('A-access');
  expect(refreshes()).toHaveLength(0);
  expect(streams()).toHaveLength(1);
});
