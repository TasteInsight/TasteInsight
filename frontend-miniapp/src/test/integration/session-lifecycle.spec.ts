import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { effectScope, type EffectScope } from 'vue';
import request from '@/utils/request';
import { useUserStore } from '@/store/modules/use-user-store';
import { useChatStore } from '@/store/modules/use-chat-store';
import { useChat } from '@/pages/ai-chat/composables/use-chat';
import ChatPage from '@/pages/ai-chat/index.vue';
import { getUserProfile, wechatLogin } from '@/api/modules/user';
import { createAISession, streamAIChat, getAISuggestions, deleteAISession } from '@/api/modules/ai';
import { mockInterceptor } from '@/mock/mock-adapter';

jest.mock('@/config', () => ({ baseUrl: 'http://api.test' }));
jest.mock('@/mock/mock-adapter', () => ({ mockInterceptor: jest.fn(), USE_MOCK: false }));
jest.mock('@/mock/mock-routes', () => ({}));
jest.mock('@/api/modules/user', () => ({ wechatLogin: jest.fn(), getUserProfile: jest.fn() }));
jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  streamAIChat: jest.fn(),
  submitRecommendFeedback: jest.fn(),
  deleteAISession: jest.fn(),
  getAISuggestions: jest.fn(),
}));

const storage = new Map<string, any>();
const requests: any[] = [];
const streams: { callbacks: any; close: jest.Mock }[] = [];
const mockRequest = jest.fn();
const mockReLaunch = jest.fn();
const user = (id: string) => ({ id, openId: `${id}-openid`, nickname: id });
const login = (id: string) => ({
  data: {
    token: { accessToken: `${id}-access`, refreshToken: `${id}-refresh` },
    user: user(id),
  },
});
const ok = (data: any) => ({ statusCode: 200, data: { code: 200, data } });
const unauthorized = () => ({ statusCode: 401, data: { code: 401 } });
const defer = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
};

(global as any).uni = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: any) => storage.set(key, JSON.parse(JSON.stringify(value))),
  removeStorageSync: (key: string) => storage.delete(key),
  request: mockRequest,
  reLaunch: mockReLaunch,
  showToast: jest.fn(),
  showModal: jest.fn((options: any) => options.success({ confirm: true })),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  $emit: jest.fn(),
  getSystemInfoSync: () => ({ windowWidth: 375, safeAreaInsets: { top: 0, bottom: 0 } }),
};

beforeEach(() => {
  jest.clearAllMocks();
  storage.clear();
  storage.set('token', 'A-access');
  storage.set('refreshToken', 'A-refresh');
  storage.set('userInfo', JSON.stringify(user('A')));
  requests.length = 0;
  streams.length = 0;
  setActivePinia(createPinia());
  mockRequest.mockReset().mockImplementation(options => {
    requests.push(options);
    return { abort: jest.fn() };
  });
  (mockInterceptor as jest.Mock).mockResolvedValue(null);
  (wechatLogin as jest.Mock).mockReset().mockImplementation(async (id: string) => login(id));
  (getUserProfile as jest.Mock).mockReset().mockImplementation(async () => ({
    code: 200,
    data: user(useUserStore().token!.split('-')[0]),
  }));
  (createAISession as jest.Mock).mockReset().mockImplementation(async () => ({
    code: 200,
    data: { sessionId: `${useUserStore().userInfo!.id}-session`, welcomeMessage: 'welcome' },
  }));
  (streamAIChat as jest.Mock).mockReset().mockImplementation((_session, _payload, callbacks) => {
    const stream = { callbacks, close: jest.fn() };
    streams.push(stream);
    return { close: stream.close };
  });
  (getAISuggestions as jest.Mock).mockReset().mockResolvedValue({
    code: 200, data: { suggestions: ['current suggestion'] },
  });
  (deleteAISession as jest.Mock).mockReset().mockResolvedValue({ code: 200 });
});

describe('request session ownership', () => {
  test.each(['success', 'failure'])('ignores an old refresh %s after another login', async outcome => {
    const store = useUserStore();
    const pending = request({ url: '/user/profile' });
    const rejected = expect(pending).rejects.toThrow();
    await flushPromises();
    requests[0].success(unauthorized());
    const refresh = requests[1];
    store.logoutAction();
    await store.loginAction('B');

    if (outcome === 'success') refresh.success(ok(login('A').data));
    else refresh.fail({ errMsg: 'refresh failed' });
    await rejected;

    expect(store.userInfo!.id).toBe('B');
    expect(store.token).toBe('B-access');
    expect(storage.get('refreshToken')).toBe('B-refresh');
    expect(requests).toHaveLength(2);
    expect(mockReLaunch).not.toHaveBeenCalled();
  });

  test('a pending refresh cannot restore a logged-out session', async () => {
    const store = useUserStore();
    const pending = request({ url: '/user/profile' });
    const rejected = expect(pending).rejects.toThrow();
    await flushPromises();
    requests[0].success(unauthorized());
    store.logoutAction();
    requests[1].success(ok(login('A').data));
    await rejected;
    expect(store.isLoggedIn).toBe(false);
    expect(storage.has('token')).toBe(false);
    expect(requests).toHaveLength(2);
  });

  test.each([200, 401])('rejects an old HTTP %i without affecting the new session', async status => {
    const store = useUserStore();
    const pending = request({ url: '/user/profile' });
    const rejected = expect(pending).rejects.toThrow();
    await flushPromises();
    store.logoutAction();
    await store.loginAction('B');
    requests[0].success(status === 200 ? ok(user('A')) : unauthorized());
    await rejected;
    expect(store.token).toBe('B-access');
    expect(requests).toHaveLength(1);
    expect(mockReLaunch).not.toHaveBeenCalled();
  });

  test('parallel 401 responses share a refresh for the same session', async () => {
    const first = request({ url: '/first' });
    const second = request({ url: '/second' });
    await flushPromises();
    requests[0].success(unauthorized());
    requests[1].success(unauthorized());
    expect(requests.filter(item => item.url.endsWith('/auth/refresh'))).toHaveLength(1);
    requests[2].success(ok({ token: { accessToken: 'A-new', refreshToken: 'A-new-refresh' } }));
    await flushPromises();
    requests.slice(3).forEach(item => {
      expect(item.header.Authorization).toBe('Bearer A-new');
      item.success(ok('retried'));
    });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  test('a delayed 401 reuses an already refreshed access token', async () => {
    const first = request({ url: '/first' });
    const second = request({ url: '/second' });
    await flushPromises();
    requests[0].success(unauthorized());
    requests[2].success(ok({ token: { accessToken: 'A-new', refreshToken: 'A-new-refresh' } }));
    await flushPromises();
    requests[3].success(ok('first'));
    await first;
    requests[1].success(unauthorized());
    await flushPromises();
    expect(requests.filter(item => item.url.endsWith('/auth/refresh'))).toHaveLength(1);
    requests[4].success(ok('second'));
    await expect(second).resolves.toMatchObject({ data: 'second' });
  });

  test('a late profile response cannot replace the new account profile', async () => {
    let resolveProfile!: (value: any) => void;
    (getUserProfile as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
      resolveProfile = resolve;
    }));
    const store = useUserStore();
    const profile = store.fetchProfileAction();
    store.logoutAction();
    await store.loginAction('B');
    resolveProfile({ code: 200, data: user('A') });
    await profile;
    expect(store.userInfo!.id).toBe('B');
    expect(JSON.parse(storage.get('userInfo')).id).toBe('B');
  });

  test('completion of an old refresh does not release the new account refresh lock', async () => {
    const old = request({ url: '/A' });
    const rejected = expect(old).rejects.toThrow();
    await flushPromises();
    requests[0].success(unauthorized());
    await useUserStore().loginAction('B');
    const current = request({ url: '/B' });
    await flushPromises();
    requests[2].success(unauthorized());
    requests[1].fail({ errMsg: 'old refresh failed' });
    await rejected;
    const another = request({ url: '/B-again' });
    await flushPromises();
    requests[4].success(unauthorized());
    expect(requests.filter(item => item.url.endsWith('/auth/refresh'))).toHaveLength(2);
    requests[3].success(ok({ token: { accessToken: 'B-new', refreshToken: 'B-new-refresh' } }));
    await flushPromises();
    requests.slice(5).forEach(item => item.success(ok('B response')));
    await expect(Promise.all([current, another])).resolves.toHaveLength(2);
    expect(useUserStore().token).toBe('B-new');
  });

  test('a superseded login result cannot overwrite or log out a newer login', async () => {
    let resolveLogin!: (value: any) => void;
    (wechatLogin as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
      resolveLogin = resolve;
    }));
    const store = useUserStore();
    const old = store.loginAction('A');
    const rejected = expect(old).rejects.toThrow();
    await store.loginAction('B');
    resolveLogin(login('A'));
    await rejected;
    expect(store.token).toBe('B-access');
    expect(store.userInfo!.id).toBe('B');
  });
});

describe('chat session ownership', () => {
  test('unknown-owner legacy history is left intact and is not exposed as account history', () => {
    const legacy = [{ sessionId: 'unknown-owner', messages: [{ content: [{ text: 'private' }] }] }];
    storage.set('ai-chat-history', legacy);
    expect(useChatStore().historyEntries).toEqual([]);
    expect(storage.get('ai-chat-history')).toEqual(legacy);
  });

  test('rotating tokens for the same login keeps the active conversation', async () => {
    const store = useChatStore();
    await store.sendChatMessage('keep current conversation');
    const currentSession = useUserStore().sessionVersion;
    useUserStore().updateTokens(currentSession, 'A-new', 'A-new-refresh');
    expect(useUserStore().sessionVersion).toBe(currentSession);
    expect(store.sessionId).toBe('A-session');
    expect(store.aiLoading).toBe(true);
    expect(streams[0].close).not.toHaveBeenCalled();
    streams[0].callbacks.onComplete();
  });

  test('switching accounts clears active chat and restores only that account history', async () => {
    const store = useChatStore();
    await store.sendChatMessage('A private prompt');
    streams[0].callbacks.onEvent('text_chunk');
    streams[0].callbacks.onMessage('A partial answer');
    useUserStore().logoutAction();
    expect(streams[0].close).toHaveBeenCalledTimes(1);
    expect(store.messages).toEqual([]);
    expect(store.historyEntries).toEqual([]);
    expect(storage.get('ai-chat-history:A')[0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'user', content: [{ type: 'text', text: 'A private prompt' }] }),
    ]));

    await useUserStore().loginAction('B');
    await store.initSession();
    expect(store.sessionId).toBe('B-session');
    expect(store.loadSessionFromHistory('A-session')).toBe(false);
    await useUserStore().loginAction('A');
    expect(store.messages).toEqual([]);
    expect(store.loadSessionFromHistory('A-session')).toBe(true);
    expect(store.messages.some(message => message.type === 'user')).toBe(true);
  });

  test('late callbacks from an old account do not finish or alter the new stream', async () => {
    const store = useChatStore();
    await store.sendChatMessage('A prompt');
    const oldStream = streams[0];
    await useUserStore().loginAction('B');
    await store.sendChatMessage('B prompt');
    oldStream.callbacks.onEvent('text_chunk');
    oldStream.callbacks.onMessage('old response');
    oldStream.callbacks.onComplete();
    expect(store.aiLoading).toBe(true);
    expect(JSON.stringify(store.messages)).not.toContain('old response');
    streams[1].callbacks.onComplete();
    expect(storage.get('ai-chat-history:B')[0].sessionId).toBe('B-session');
    expect(JSON.stringify(storage.get('ai-chat-history:B'))).not.toContain('A prompt');
  });

  test('loading history saves and stops the outgoing stream before replacing messages', async () => {
    storage.set('ai-chat-history:A', [{
      sessionId: 'saved-session', scene: 'dish_critic', updatedAt: 1,
      messages: [{ id: 1, type: 'user', timestamp: 1, content: [{ type: 'text', text: 'saved' }] }],
    }]);
    const store = useChatStore();
    await store.sendChatMessage('in-flight prompt');
    streams[0].callbacks.onEvent('text_chunk');
    streams[0].callbacks.onMessage('partial answer');
    expect(store.loadSessionFromHistory('saved-session')).toBe(true);
    expect(streams[0].close).toHaveBeenCalledTimes(1);
    expect(store.aiLoading).toBe(false);
    streams[0].callbacks.onMessage('late answer');
    streams[0].callbacks.onComplete();
    expect(store.messages[0].content).toEqual([{ type: 'text', text: 'saved' }]);
    const saved = storage.get('ai-chat-history:A').find((entry: any) => entry.sessionId === 'A-session');
    expect(JSON.stringify(saved.messages)).toContain('in-flight prompt');
    expect(JSON.stringify(saved.messages)).toContain('partial answer');
    expect(JSON.stringify(saved.messages)).not.toContain('late answer');
    expect(saved.messages.every((message: any) => !message.isStreaming)).toBe(true);
  });

  test('a late session creation cannot override a new account session', async () => {
    let resolveSession!: (value: any) => void;
    (createAISession as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
      resolveSession = resolve;
    }));
    const store = useChatStore();
    const oldInit = store.initSession();
    await useUserStore().loginAction('B');
    await store.initSession();
    resolveSession({ code: 200, data: { sessionId: 'late-A', welcomeMessage: 'A welcome' } });
    await oldInit;
    expect(store.sessionId).toBe('B-session');
    expect(JSON.stringify(store.messages)).not.toContain('A welcome');
  });

  test('an error terminal saves received content before switching history and returning', async () => {
    storage.set('ai-chat-history:A', [{
      sessionId: 'saved-session', scene: 'general_chat', updatedAt: 1, messages: [],
    }]);
    const store = useChatStore();
    await store.sendChatMessage('failed stream prompt');
    streams[0].callbacks.onEvent('text_chunk');
    streams[0].callbacks.onMessage('received text');
    streams[0].callbacks.onError(new Error('provider failed'));
    expect(store.aiLoading).toBe(false);
    store.loadSessionFromHistory('saved-session');
    expect(store.loadSessionFromHistory('A-session')).toBe(true);
    expect(JSON.stringify(store.messages)).toContain('failed stream prompt');
    expect(JSON.stringify(store.messages)).toContain('received text');
    expect(JSON.stringify(store.messages)).toContain('provider failed');
    expect(store.messages.every(message => !message.isStreaming)).toBe(true);
  });

  test('saving the outgoing stream at the history limit does not prevent loading the selected entry', async () => {
    storage.set('ai-chat-history:A', Array.from({ length: 20 }, (_, index) => ({
      sessionId: `saved-${index}`, scene: 'general_chat', updatedAt: index,
      messages: [{ id: index, type: 'user', timestamp: index, content: [{ type: 'text', text: `saved ${index}` }] }],
    })));
    (createAISession as jest.Mock).mockResolvedValueOnce({ code: 200, data: { sessionId: 'A-session' } });
    const store = useChatStore();
    await store.sendChatMessage('new conversation');
    expect(store.loadSessionFromHistory('saved-19')).toBe(true);
    expect(store.messages[0].content).toEqual([{ type: 'text', text: 'saved 19' }]);
    expect(store.historyEntries).toHaveLength(20);
    expect(streams[0].close).toHaveBeenCalledTimes(1);
  });

  test('concurrent sends share one accepted submission and stale completion cannot stop the next stream', async () => {
    let resolveSession!: (value: any) => void;
    (createAISession as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
      resolveSession = resolve;
    }));
    const store = useChatStore();
    const first = store.sendChatMessage('first');
    const second = store.sendChatMessage('second');
    expect(createAISession).toHaveBeenCalledTimes(1);
    resolveSession({ code: 200, data: { sessionId: 'A-session' } });
    expect(await second).toBe(false);
    expect(await first).toBe(true);
    expect(streams).toHaveLength(1);
    expect(streams[0].close).not.toHaveBeenCalled();
    store.abortChat(false);
    expect(await store.sendChatMessage('next')).toBe(true);
    expect(streams).toHaveLength(2);
    expect(streams[0].close).toHaveBeenCalledTimes(1);
    streams[0].callbacks.onComplete();
    expect(store.aiLoading).toBe(true);
  });
});

describe('chat consumer operation ownership', () => {
  const scopes: EffectScope[] = [];
  let warning: jest.SpyInstance;
  const consumer = () => {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(useChat)!;
  };
  const saveHistory = () => storage.set('ai-chat-history:A', [{
    sessionId: 'saved-session', scene: 'general_chat', updatedAt: 1,
    messages: [
      { id: 1, type: 'user', timestamp: 1, content: [{ type: 'text', text: 'saved' }] },
      { id: 2, type: 'ai', timestamp: 2, content: [{ type: 'text', text: 'saved answer' }], suggestions: ['saved follow-up'] },
    ],
  }]);

  beforeEach(() => {
    warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    scopes.splice(0).forEach(scope => scope.stop());
    warning.mockRestore();
  });

  test.each(['initialize', 'new session', 'send'])(
    'an old %s cannot fetch suggestions under a later login',
    async action => {
      const creation = defer();
      (createAISession as jest.Mock).mockReturnValueOnce(creation.promise);
      const chat = consumer();
      const pending = action === 'initialize'
        ? chat.init()
        : action === 'new session' ? chat.resetChat() : chat.sendMessage('A message');
      await useUserStore().loginAction('B');
      creation.resolve({ code: 200, data: { sessionId: 'late-A', welcomeMessage: 'A welcome' } });
      await pending;
      expect(getAISuggestions).not.toHaveBeenCalled();
      expect(chat.suggestions.value).toEqual([]);
      expect(chat.currentSessionId.value).toBe('');
      expect(chat.isInitializing.value).toBe(false);
    }
  );

  test('an old deletion cannot fetch suggestions or report completion in a later login', async () => {
    const chat = consumer();
    await chat.init();
    (getAISuggestions as jest.Mock).mockClear();
    const deletion = defer();
    (deleteAISession as jest.Mock).mockReturnValueOnce(deletion.promise);
    const pending = chat.deleteSession('A-session');
    await useUserStore().loginAction('B');
    deletion.resolve({ code: 200 });
    expect(await pending).toBeUndefined();
    expect(getAISuggestions).not.toHaveBeenCalled();
    expect(chat.suggestions.value).toEqual([]);
  });

  test('history selection restores its follow-ups without awaiting generic suggestions or obsolete initialization', async () => {
    saveHistory();
    const creation = defer();
    (createAISession as jest.Mock).mockReturnValueOnce(creation.promise);
    const chat = consumer();
    const old = chat.init();
    const selected = chat.loadHistorySession('saved-session');
    creation.resolve({ code: 200, data: { sessionId: 'obsolete-session' } });
    await old;
    expect(getAISuggestions).not.toHaveBeenCalled();
    expect(chat.currentSessionId.value).toBe('saved-session');
    expect(await selected).toBe(true);
    expect(chat.isInitializing.value).toBe(false);
    expect(chat.suggestions.value).toEqual(['saved follow-up']);
  });

  test('a superseded suggestion response cannot replace or finish the selected conversation', async () => {
    saveHistory();
    const initial = defer();
    (getAISuggestions as jest.Mock)
      .mockReturnValueOnce(initial.promise);
    const chat = consumer();
    const old = chat.init();
    await flushPromises();
    const current = chat.loadHistorySession('saved-session');
    initial.resolve({ code: 200, data: { suggestions: ['obsolete suggestion'] } });
    await old;
    expect(await current).toBe(true);
    expect(getAISuggestions).toHaveBeenCalledTimes(1);
    expect(chat.suggestions.value).toEqual(['saved follow-up']);
    expect(chat.isInitializing.value).toBe(false);
  });

  test('disposing the consumer stops the continuation after pending session creation', async () => {
    const creation = defer();
    (createAISession as jest.Mock).mockReturnValueOnce(creation.promise);
    const chat = consumer();
    const pending = chat.init();
    scopes[0].stop();
    creation.resolve({ code: 200, data: { sessionId: 'A-session' } });
    await pending;
    expect(getAISuggestions).not.toHaveBeenCalled();
  });

  test('a disposed consumer cannot begin sending with the next account conversation', async () => {
    const chat = consumer();
    scopes[0].stop();
    await useUserStore().loginAction('B');
    await useChatStore().initSession();
    await chat.sendMessage('delayed apply-plan follow-up');
    expect(streamAIChat).not.toHaveBeenCalled();
    expect(getAISuggestions).not.toHaveBeenCalled();
  });

  test('unsuccessful creation does not start suggestions and a later valid initialization still completes', async () => {
    (createAISession as jest.Mock).mockResolvedValueOnce({ code: 500 });
    const chat = consumer();
    await chat.init();
    expect(getAISuggestions).not.toHaveBeenCalled();
    expect(chat.isInitializing.value).toBe(false);
    await chat.init();
    expect(getAISuggestions).toHaveBeenCalledTimes(1);
    expect(chat.isInitializing.value).toBe(false);
    await flushPromises();
    expect(chat.suggestions.value).toEqual(['current suggestion']);
    expect(chat.currentSessionId.value).toBe('A-session');
    expect(chat.isInitialLoading.value).toBe(false);
  });
});

describe('chat page operation ownership', () => {
  const wrappers: any[] = [];
  const page = async (openingOnly = false) => {
    storage.set('ai-chat-history:A', ['first', 'second'].map(sessionId => ({
      sessionId, scene: 'general_chat', updatedAt: 1,
      messages: [{ id: 1, type: openingOnly ? 'ai' : 'user', timestamp: 1, content: [{ type: 'text', text: sessionId }] }],
    })));
    const wrapper = shallowMount(ChatPage);
    wrappers.push(wrapper);
    await flushPromises();
    (wrapper.vm as any).openHistory();
    return wrapper.vm as any;
  };
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test.each(['login change', 'disposal'])(
    'optional history suggestions finishing after %s cannot affect current ownership or panel state',
    async change => {
      const vm = await page(true);
      const suggestions = defer();
      (getAISuggestions as jest.Mock).mockReturnValueOnce(suggestions.promise);
      const pending = vm.handleLoadHistory('first');
      await pending;
      expect(vm.showHistory).toBe(false);
      expect(useChatStore().sessionId).toBe('first');
      if (change === 'login change') {
        await useUserStore().loginAction('B');
        vm.openHistory();
      } else wrappers[0].unmount();
      suggestions.resolve({ code: 200, data: { suggestions: ['obsolete'] } });
      await flushPromises();
      expect(uni.showToast).not.toHaveBeenCalled();
      expect(vm.showHistory).toBe(change === 'login change');
      expect(vm.suggestions).not.toContain('obsolete');
      if (change === 'login change') {
        expect(useChatStore().sessionId).toBe('');
        expect(useChatStore().messages).toEqual([]);
      }
    }
  );

  test('superseded history suggestions cannot close a reopened panel or replace the selected conversation', async () => {
    const vm = await page(true);
    const first = defer();
    const second = defer();
    (getAISuggestions as jest.Mock)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const old = vm.handleLoadHistory('first');
    await old;
    expect(vm.showHistory).toBe(false);
    vm.openHistory();
    const current = vm.handleLoadHistory('second');
    await current;
    expect(vm.showHistory).toBe(false);
    vm.openHistory();
    first.resolve({ code: 200, data: { suggestions: ['first'] } });
    await flushPromises();
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(vm.showHistory).toBe(true);
    expect(useChatStore().sessionId).toBe('second');
    expect(vm.suggestions).not.toContain('first');
    second.resolve({ code: 200, data: { suggestions: ['second'] } });
    await flushPromises();
    expect(vm.showHistory).toBe(true);
    expect(vm.suggestions).toEqual(['second']);
    expect(useChatStore().sessionId).toBe('second');
  });

  test('an old current-session deletion does not close the new login history panel', async () => {
    const vm = await page();
    const deletion = defer();
    (deleteAISession as jest.Mock).mockReturnValueOnce(deletion.promise);
    const pending = vm.handleDeleteHistory('A-session');
    await useUserStore().loginAction('B');
    deletion.resolve({ code: 200 });
    await pending;
    expect(vm.showHistory).toBe(true);
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  test('a current missing-history selection preserves failure feedback', async () => {
    const vm = await page();
    await vm.handleLoadHistory('missing');
    expect(uni.showToast).toHaveBeenCalledWith({ title: '加载历史失败', icon: 'none' });
    expect(vm.showHistory).toBe(true);
  });

  test('a current successful deletion closes history after replacement session creation', async () => {
    const vm = await page();
    await vm.handleDeleteHistory('A-session');
    expect(deleteAISession).toHaveBeenCalledWith('A-session');
    expect(vm.showHistory).toBe(false);
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  const mealPlan = () => ({
    confirmAction: { body: {
      startDate: '2026-10-03', endDate: '2026-10-03', mealTime: 'lunch', dishes: ['dish'],
    } },
  });
  const mealRequest = () => [...requests].reverse().find(item => item.url.endsWith('/meal-plans'));
  const readCard = (messages = useChatStore().messages) => messages
    .flatMap(message => message.content)
    .filter(segment => segment.type === 'card_plan')
    .flatMap(segment => (segment as any).data)
    .slice(-1)[0];
  const storedCard = (session = 'A-session', owner = 'A') => readCard(
    storage.get(`ai-chat-history:${owner}`).find((entry: any) => entry.sessionId === session).messages
  );
  const streamedPlan = async (dishes = ['dish']) => {
    const store = useChatStore();
    await store.sendChatMessage('make plan');
    const callbacks = streams[streams.length - 1].callbacks;
    const draft = mealPlan();
    draft.confirmAction.body.dishes = dishes;
    callbacks.onEvent('new_block');
    callbacks.onJSON({ type: 'card_plan', data: [draft] });
    callbacks.onComplete();
    (streamAIChat as jest.Mock).mockClear();
    return readCard();
  };

  test.each(['disposal', 'history selection'])(
    'a real streamed plan commits to its account history after %s without stale UI effects',
    async change => {
      const vm = await page();
      const source = await streamedPlan();
      const pending = vm.handleApplyPlan(source);
      await flushPromises();
      const application = mealRequest();
      if (change === 'disposal') wrappers[0].unmount();
      else await vm.handleLoadHistory('first');
      application.success(ok({ id: 'committed' }));
      await pending;
      expect(source.appliedStatus).toBe('success');
      expect(storedCard().appliedStatus).toBe('success');
      expect(uni.$emit).toHaveBeenCalledWith('meal-plan:changed');
      expect(uni.showToast).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500);
      await flushPromises();
      expect(streamAIChat).not.toHaveBeenCalled();
      if (change === 'history selection') {
        await vm.handleLoadHistory('A-session');
        expect(readCard()).not.toBe(source);
        expect(readCard().appliedStatus).toBe('success');
        await vm.handleApplyPlan(readCard());
        expect(requests.filter(item => item.url.endsWith('/meal-plans'))).toHaveLength(1);
      }
    }
  );

  test.each(['new message', 'history selection', 'new conversation'])(
    'a committed plan remains applied when %s supersedes its chat continuation',
    async change => {
      const vm = await page();
      const plan = await streamedPlan();
      const pending = vm.handleApplyPlan(plan);
      await flushPromises();
      const application = mealRequest();
      if (change === 'new message') vm.handleSend('another question');
      else if (change === 'history selection') await vm.handleLoadHistory('first');
      else {
        (createAISession as jest.Mock).mockResolvedValueOnce({ code: 200, data: { sessionId: 'new-conversation', welcomeMessage: 'welcome' } });
        vm.confirmNewChat();
      }
      await flushPromises();
      expect(uni.hideLoading).toHaveBeenCalledTimes(1);
      const duplicate = vm.handleApplyPlan(plan);
      await flushPromises();
      expect(requests.filter(item => item.url.endsWith('/meal-plans'))).toHaveLength(1);
      await duplicate;
      application.success(ok({ id: 'applied-plan' }));
      await pending;
      expect(plan).toHaveProperty('appliedStatus', 'success');
      expect(storedCard().appliedStatus).toBe('success');
      expect(uni.$emit).toHaveBeenCalledWith('meal-plan:changed');
      expect(uni.showToast).not.toHaveBeenCalled();
      const sent = (streamAIChat as jest.Mock).mock.calls.length;
      jest.advanceTimersByTime(500);
      await flushPromises();
      expect(streamAIChat).toHaveBeenCalledTimes(sent);
      await vm.handleApplyPlan(plan);
      expect(requests.filter(item => item.url.endsWith('/meal-plans'))).toHaveLength(1);
    }
  );

  test.each(['login change', 'disposal', 'history selection', 'new conversation', 'new message'])(
    'a successful plan follow-up is canceled after %s during its delay',
    async change => {
      const vm = await page();
      const plan = await streamedPlan();
      const applied = vm.handleApplyPlan(plan);
      await flushPromises();
      mealRequest().success(ok({ id: 'A-plan' }));
      await applied;
      if (change === 'login change') {
        await useUserStore().loginAction('B');
        await useChatStore().initSession();
      } else if (change === 'disposal') {
        wrappers[0].unmount();
      } else if (change === 'history selection') {
        await vm.handleLoadHistory('first');
      } else if (change === 'new conversation') {
        vm.confirmNewChat();
        await flushPromises();
      } else {
        vm.handleSend('new user message');
        await flushPromises();
      }
      const sent = (streamAIChat as jest.Mock).mock.calls.length;
      jest.advanceTimersByTime(500);
      await flushPromises();
      expect(streamAIChat).toHaveBeenCalledTimes(sent);
    }
  );

  test.each(['success', 'failure'])(
    'a stale plan %s cannot show feedback, emit refresh, or settle the next account loading',
    async outcome => {
      const vm = await page();
      const oldPlan = await streamedPlan();
      const old = vm.handleApplyPlan(oldPlan);
      await flushPromises();
      const oldRequest = mealRequest();
      await useUserStore().loginAction('B');
      await useChatStore().initSession();
      const currentPlan = await streamedPlan();
      const current = vm.handleApplyPlan(currentPlan);
      await flushPromises();
      const currentRequest = mealRequest();
      expect(currentRequest.header.Authorization).toBe('Bearer B-access');
      const hidden = (uni.hideLoading as jest.Mock).mock.calls.length;
      oldRequest.success(outcome === 'success'
        ? ok({ id: 'A-plan' })
        : { statusCode: 500, data: { code: 500, message: 'old failure' } });
      await old;
      jest.advanceTimersByTime(500);
      await flushPromises();
      expect(uni.showToast).not.toHaveBeenCalled();
      expect(uni.$emit).not.toHaveBeenCalled();
      expect(uni.hideLoading).toHaveBeenCalledTimes(hidden);
      expect(oldPlan).not.toHaveProperty('appliedStatus');
      expect(storedCard()).not.toHaveProperty('appliedStatus');
      expect(storedCard('B-session', 'B')).not.toHaveProperty('appliedStatus');
      expect(streamAIChat).not.toHaveBeenCalled();
      currentRequest.success(ok({ id: 'B-plan' }));
      await current;
      expect(currentPlan).toHaveProperty('appliedStatus', 'success');
      expect(storedCard('B-session', 'B').appliedStatus).toBe('success');
    }
  );

  test('reopening the page cannot resubmit a pending plan and receives its committed status', async () => {
    const vm = await page();
    const plan = await streamedPlan();
    const pending = vm.handleApplyPlan(plan);
    await flushPromises();
    const application = mealRequest();
    wrappers[0].unmount();
    expect(uni.hideLoading).toHaveBeenCalledTimes(1);
    const reopened = shallowMount(ChatPage);
    wrappers.push(reopened);
    await flushPromises();
    const current = reopened.vm as any;
    await current.handleLoadHistory('first');
    await current.handleLoadHistory('A-session');
    const reloadedPlan = readCard();
    expect(reloadedPlan).not.toBe(plan);
    await current.handleApplyPlan(reloadedPlan);
    expect(requests.filter(item => item.url.endsWith('/meal-plans'))).toHaveLength(1);
    application.success(ok({ id: 'A-plan' }));
    await pending;
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(uni.$emit).toHaveBeenCalledWith('meal-plan:changed');
    expect(streamAIChat).not.toHaveBeenCalled();
    expect(plan.appliedStatus).toBe('success');
    expect(reloadedPlan.appliedStatus).toBe('success');
    expect(storedCard().appliedStatus).toBe('success');
  });

  test('a current successful plan refreshes planning and sends exactly one follow-up to its conversation', async () => {
    const vm = await page();
    const plan = await streamedPlan();
    const pending = vm.handleApplyPlan(plan);
    await flushPromises();
    mealRequest().success(ok({ id: 'A-plan' }));
    await pending;
    expect(plan).toHaveProperty('appliedStatus', 'success');
    expect(storedCard().appliedStatus).toBe('success');
    expect(uni.$emit).toHaveBeenCalledWith('meal-plan:changed');
    expect(uni.showToast).toHaveBeenCalledWith({ title: '已加入我的规划', icon: 'success' });
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(streamAIChat).toHaveBeenCalledTimes(1);
    expect((streamAIChat as jest.Mock).mock.calls[0][0]).toBe('A-session');
  });

  test('applying a second plan replaces the first delayed follow-up without canceling the pending application', async () => {
    const vm = await page();
    const firstPlan = await streamedPlan();
    const first = vm.handleApplyPlan(firstPlan);
    await flushPromises();
    mealRequest().success(ok({ id: 'first-plan' }));
    await first;

    const secondPlan = await streamedPlan(['second-dish']);
    const second = vm.handleApplyPlan(secondPlan);
    await flushPromises();
    const secondRequest = mealRequest();
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(streamAIChat).not.toHaveBeenCalled();
    expect(uni.hideLoading).toHaveBeenCalledTimes(1);

    secondRequest.success(ok({ id: 'second-plan' }));
    await second;
    expect(firstPlan).toHaveProperty('appliedStatus', 'success');
    expect(secondPlan).toHaveProperty('appliedStatus', 'success');
    expect(uni.$emit).toHaveBeenCalledTimes(2);
    expect(uni.showToast).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(streamAIChat).toHaveBeenCalledTimes(1);
    expect((streamAIChat as jest.Mock).mock.calls[0][0]).toBe('A-session');
  });

  test('a current failed plan retains retry feedback and never schedules a follow-up', async () => {
    const vm = await page();
    const plan = await streamedPlan();
    const pending = vm.handleApplyPlan(plan);
    await flushPromises();
    mealRequest().success({ statusCode: 500, data: { code: 500, message: 'failure' } });
    await pending;
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(plan).toHaveProperty('appliedStatus', 'failed');
    expect(storedCard().appliedStatus).toBe('failed');
    expect(uni.showToast).toHaveBeenCalledWith({ title: '加入失败，请重试', icon: 'none' });
    expect(uni.$emit).not.toHaveBeenCalled();
    expect(streamAIChat).not.toHaveBeenCalled();
  });

  test('a failed archived plan can be reloaded and successfully retried', async () => {
    const vm = await page();
    const plan = await streamedPlan();
    const first = vm.handleApplyPlan(plan);
    await flushPromises();
    mealRequest().success({ statusCode: 500, data: { code: 500, message: 'failure' } });
    await first;
    await vm.handleLoadHistory('first');
    await vm.handleLoadHistory('A-session');
    const reloaded = readCard();
    expect(reloaded.appliedStatus).toBe('failed');
    const retry = vm.handleApplyPlan(reloaded);
    await flushPromises();
    expect(requests.filter(item => item.url.endsWith('/meal-plans'))).toHaveLength(2);
    mealRequest().success(ok({ id: 'retry-plan' }));
    await retry;
    expect(reloaded.appliedStatus).toBe('success');
    expect(storedCard().appliedStatus).toBe('success');
    expect(uni.$emit).toHaveBeenCalledTimes(1);
  });

  test('an old conversation application cannot dismiss the next conversation application loading', async () => {
    const vm = await page();
    const firstPlan = await streamedPlan();
    const first = vm.handleApplyPlan(firstPlan);
    await flushPromises();
    const oldRequest = mealRequest();
    await vm.handleLoadHistory('first');
    const nextPlan = await streamedPlan(['next-dish']);
    const next = vm.handleApplyPlan(nextPlan);
    await flushPromises();
    const nextRequest = mealRequest();
    const hidden = (uni.hideLoading as jest.Mock).mock.calls.length;
    oldRequest.success(ok({ id: 'old-plan' }));
    await first;
    expect(uni.hideLoading).toHaveBeenCalledTimes(hidden);
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(storedCard().appliedStatus).toBe('success');
    expect(storedCard('first')).not.toHaveProperty('appliedStatus');
    nextRequest.success(ok({ id: 'next-plan' }));
    await next;
    expect(storedCard('first').appliedStatus).toBe('success');
    expect(uni.$emit).toHaveBeenCalledTimes(2);
    expect(uni.showToast).toHaveBeenCalledTimes(1);
  });
});
