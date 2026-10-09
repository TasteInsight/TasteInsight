import { createPinia, setActivePinia } from 'pinia';
import { reactive, watch } from 'vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import { createAISession, streamAIChat } from '@/api/modules/ai';
import type { AIStreamCallbacks } from '@/types/api';

jest.mock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
jest.mock('@/api/modules/meal-plan', () => ({ createMealPlan: jest.fn() }));
jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  streamAIChat: jest.fn(),
  submitRecommendFeedback: jest.fn(),
  deleteAISession: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));

const mockUser = reactive({
  sessionVersion: 0,
  isLoggedIn: true,
  userInfo: { id: 'A' },
});
const storage = new Map<string, any>();
const streams: { callbacks: AIStreamCallbacks; close: jest.Mock }[] = [];
const copy = (value: any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const receive = (callbacks: AIStreamCallbacks) => {
  callbacks.onEvent?.('message_received');
  callbacks.onJSON?.({ messageId: 'persisted-message' });
};
const userMessage = (store: ReturnType<typeof useChatStore>) =>
  store.messages.filter(message => message.type === 'user').slice(-1)[0];
const delivery = (store: ReturnType<typeof useChatStore>) => (userMessage(store) as any)?.deliveryStatus;
const savedDelivery = () => storage.get('ai-chat-history:A')?.[0]?.messages
  .filter((message: any) => message.type === 'user').slice(-1)[0]?.deliveryStatus;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.sessionVersion = 0;
  mockUser.userInfo = { id: 'A' };
  storage.clear();
  streams.length = 0;
  (globalThis as any).uni = {
    getStorageSync: (key: string) => copy(storage.get(key)),
    setStorageSync: (key: string, value: any) => storage.set(key, copy(value)),
    showToast: jest.fn(),
  };
  setActivePinia(createPinia());
  (createAISession as jest.Mock).mockReset().mockImplementation(async () => ({
    code: 200, data: { sessionId: `${mockUser.userInfo.id}-session` },
  }));
  (streamAIChat as jest.Mock).mockReset().mockImplementation((_session, _payload, callbacks) => {
    const stream = { callbacks, close: jest.fn() };
    streams.push(stream);
    return { close: stream.close };
  });
});

afterEach(() => useChatStore().$dispose());

describe('contextual follow-up ownership', () => {
  const completeReply = (callbacks: AIStreamCallbacks) => {
    callbacks.onEvent?.('text_chunk');
    callbacks.onMessage?.('第二食堂的香菇鸡肉饭比较清淡。');
    callbacks.onEvent?.('reply_complete');
    callbacks.onJSON?.({ messageId: 'reply-1' });
  };
  const suggest = (callbacks: AIStreamCallbacks, suggestions = ['在哪个窗口？']) => {
    callbacks.onEvent?.('suggestions');
    callbacks.onJSON?.({ suggestions });
  };

  test('releases the composer before suggestions and persists them on the completed answer', async () => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    completeReply(streams[0].callbacks);
    expect(store.aiLoading).toBe(false);
    expect(store.messages[1].isStreaming).toBe(false);
    suggest(streams[0].callbacks);
    streams[0].callbacks.onComplete?.();
    expect((store.messages[1] as any).suggestions).toEqual(['在哪个窗口？']);
    await store.startNewSession();
    expect(store.loadSessionFromHistory('A-session')).toBe(true);
    expect((store.messages[1] as any).suggestions).toEqual(['在哪个窗口？']);
  });

  test('accepts a new question while suggestions are pending without marking the answer interrupted', async () => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    const old = streams[0];
    completeReply(old.callbacks);
    expect(await store.sendChatMessage('有素食吗？')).toBe(true);
    expect(old.close).toHaveBeenCalled();
    suggest(old.callbacks);
    old.callbacks.onComplete?.();
    expect(store.aiLoading).toBe(true);
    expect(JSON.stringify(store.messages)).not.toContain('回复被中断');
    expect((store.messages[3] as any).suggestions).toBeUndefined();
  });

  test.each(['stop', 'new-session', 'account'])('ignores suggestions after %s', async ending => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    const old = streams[0].callbacks;
    completeReply(old);
    if (ending === 'stop') store.abortChat();
    else if (ending === 'new-session') await store.startNewSession();
    else { mockUser.sessionVersion++; mockUser.userInfo = { id: 'B' }; }
    suggest(old);
    expect(store.messages.every(message => !(message as any).suggestions)).toBe(true);
  });

  test('keeps an already completed answer intact if the remaining transport fails', async () => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    completeReply(streams[0].callbacks);
    streams[0].callbacks.onError?.(new Error('follow-up connection lost'));
    expect(store.messages[1].content).toEqual([{ type: 'text', text: '第二食堂的香菇鸡肉饭比较清淡。' }]);
    expect(store.aiLoading).toBe(false);
    expect(delivery(store)).toBe('received');
  });

  test('ignores premature or malformed follow-ups', async () => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    suggest(streams[0].callbacks);
    expect((store.messages[1] as any).suggestions).toBeUndefined();
    completeReply(streams[0].callbacks);
    streams[0].callbacks.onEvent?.('suggestions');
    streams[0].callbacks.onJSON?.({ suggestions: 'not-an-array' });
    expect((store.messages[1] as any).suggestions).toBeUndefined();
  });
});

describe('chat user-message delivery', () => {
  test('starts sending and confirms only a receipt payload, preserving the message timestamp', async () => {
    const store = useChatStore();
    expect(await store.sendChatMessage('午餐')).toBe(true);
    const timestamp = userMessage(store).timestamp;
    const callbacks = streams[0].callbacks;
    expect(delivery(store)).toBe('sending');

    callbacks.onEvent?.('progress');
    callbacks.onMessage?.('connected');
    callbacks.onJSON?.({ messageId: 'not-a-receipt' });
    expect(delivery(store)).toBe('sending');
    callbacks.onEvent?.('message_received');
    expect(delivery(store)).toBe('sending');
    callbacks.onJSON?.({});
    expect(delivery(store)).toBe('sending');
    callbacks.onJSON?.({ messageId: 'persisted-message' });
    expect(delivery(store)).toBe('received');
    expect(userMessage(store).timestamp).toBe(timestamp);
  });

  test.each(['text_chunk', 'new_block'])('confirms real legacy %s content', async event => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    const callbacks = streams[0].callbacks;
    callbacks.onEvent?.(event);
    expect(delivery(store)).toBe('sending');
    if (event === 'text_chunk') callbacks.onMessage?.('推荐这道菜');
    else callbacks.onJSON?.({ type: 'card_dish', data: [{ dish: { id: 'dish-1' } }] });
    expect(delivery(store)).toBe('received');
  });

  test('updates receipt reactively before any reply content arrives', async () => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    const observed: string[] = [];
    const stop = watch(() => delivery(store), status => observed.push(status), { flush: 'sync' });
    receive(streams[0].callbacks);
    stop();
    expect(observed).toEqual(['received']);
    expect(store.messages.filter(message => message.type === 'ai')[0].content)
      .toEqual([{ type: 'text', text: '' }]);
  });

  test.each([null, {}, { type: 'text', text: 'wrong event' }, { type: 'unknown', data: [] }, { type: 'card_dish' }])(
    'does not confirm an invalid new_block payload %j', async payload => {
      const store = useChatStore();
      await store.sendChatMessage('午餐');
      streams[0].callbacks.onEvent?.('new_block');
      streams[0].callbacks.onJSON?.(payload);
      expect(delivery(store)).toBe('sending');
    }
  );

  test.each(['complete', 'stop', 'error'])('settles an unconfirmed %s without inventing receipt', async ending => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    const callbacks = streams[0].callbacks;
    if (ending === 'stop') store.abortChat();
    else if (ending === 'error') {
      callbacks.onEvent?.('error');
      callbacks.onError?.(new Error('request failed'));
    } else callbacks.onComplete?.();

    const expected = ending === 'error' ? 'failed' : 'unconfirmed';
    expect(delivery(store)).toBe(expected);
    expect(savedDelivery()).toBe(expected);
    expect(store.aiLoading).toBe(false);
    expect(store.messages.every(message => !message.isStreaming)).toBe(true);
    receive(callbacks);
    expect(delivery(store)).toBe(expected);
  });

  test.each(['complete', 'stop', 'error'])('keeps the confirmed receipt after %s', async ending => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    const callbacks = streams[0].callbacks;
    receive(callbacks);
    if (ending === 'stop') store.abortChat();
    else if (ending === 'error') callbacks.onError?.(new Error('provider failed'));
    else callbacks.onComplete?.();

    expect(delivery(store)).toBe('received');
    expect(savedDelivery()).toBe('received');
    expect(store.aiLoading).toBe(false);
  });

  test('cleans up a synchronous transport failure and rejects local send acceptance', async () => {
    (streamAIChat as jest.Mock).mockImplementationOnce(() => { throw new Error('request unavailable'); });
    const store = useChatStore();
    await expect(store.sendChatMessage('午餐')).resolves.toBe(false);
    expect(delivery(store)).toBe('failed');
    expect(savedDelivery()).toBe('failed');
    expect(store.aiLoading).toBe(false);
    expect(store.messages.every(message => !message.isStreaming)).toBe(true);
    expect(await store.sendChatMessage('晚餐')).toBe(true);
    expect(delivery(store)).toBe('sending');
  });

  test('keeps initialization failures out of the message list', async () => {
    (createAISession as jest.Mock).mockResolvedValueOnce({ code: 500 });
    const store = useChatStore();
    expect(await store.sendChatMessage('午餐')).toBe(false);
    expect(store.messages).toEqual([]);
    expect(streamAIChat).not.toHaveBeenCalled();
  });

  test('ignores receipt and errors from a stream stopped before a new submission', async () => {
    const store = useChatStore();
    await store.sendChatMessage('午餐');
    const oldCallbacks = streams[0].callbacks;
    store.abortChat(false);
    await store.sendChatMessage('晚餐');
    receive(oldCallbacks);
    oldCallbacks.onError?.(new Error('late error'));
    oldCallbacks.onComplete?.();

    expect(store.messages.filter(message => message.type === 'user')
      .map(message => (message as any).deliveryStatus)).toEqual(['unconfirmed', 'sending']);
    expect(store.aiLoading).toBe(true);
    expect(JSON.stringify(store.messages)).not.toContain('late error');
  });

  test('isolates receipt from an old account and saves its unconfirmed state to its owner', async () => {
    const store = useChatStore();
    await store.sendChatMessage('A message');
    const oldCallbacks = streams[0].callbacks;
    mockUser.sessionVersion += 1;
    mockUser.userInfo = { id: 'B' };
    await store.sendChatMessage('B message');
    receive(oldCallbacks);
    oldCallbacks.onComplete?.();

    expect(delivery(store)).toBe('sending');
    expect(savedDelivery()).toBe('unconfirmed');
    receive(streams[1].callbacks);
    streams[1].callbacks.onComplete?.();
    expect(JSON.stringify(storage.get('ai-chat-history:B'))).not.toContain('A message');
    expect(delivery(store)).toBe('received');
  });

  test('restores pending history as unconfirmed while keeping legacy messages unknown', () => {
    const states = [undefined, 'sending', 'received', 'failed', 'unconfirmed'];
    storage.set('ai-chat-history:A', [{
      sessionId: 'saved', scene: 'general_chat', updatedAt: 1,
      messages: states.map((deliveryStatus, index) => ({
        id: index, type: 'user', timestamp: index,
        content: [{ type: 'text', text: `message ${index}` }],
        ...(deliveryStatus ? { deliveryStatus } : {}),
      })),
    }]);
    const store = useChatStore();
    expect(store.loadSessionFromHistory('saved')).toBe(true);
    expect(store.messages.map(message => (message as any).deliveryStatus))
      .toEqual([undefined, 'unconfirmed', 'received', 'failed', 'unconfirmed']);
    expect(store.messages[0]).not.toHaveProperty('deliveryStatus');
  });

  test('keeps received delivery when switching history and ignores the old receipt owner', async () => {
    storage.set('ai-chat-history:A', [{
      sessionId: 'saved', scene: 'general_chat', updatedAt: 1,
      messages: [{ id: 1, type: 'user', timestamp: 1, content: [{ type: 'text', text: 'legacy' }] }],
    }]);
    const store = useChatStore();
    await store.sendChatMessage('current');
    receive(streams[0].callbacks);
    expect(store.loadSessionFromHistory('saved')).toBe(true);
    receive(streams[0].callbacks);
    expect(delivery(store)).toBeUndefined();
    expect(store.loadSessionFromHistory('A-session')).toBe(true);
    expect(delivery(store)).toBe('received');
  });
});
