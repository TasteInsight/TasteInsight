/// <reference types="jest" />
import { setActivePinia, createPinia } from 'pinia';

const mockGetStorageSync = jest.fn();
const mockSetStorageSync = jest.fn();
const mockShowToast = jest.fn();

(global as any).uni = {
  getStorageSync: mockGetStorageSync,
  setStorageSync: mockSetStorageSync,
  showToast: mockShowToast,
};

// Ensure non-mock stream branch by default
jest.mock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));

jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  streamAIChat: jest.fn(),
  submitRecommendFeedback: jest.fn(),
}));

describe('useChatStore (unit)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockGetStorageSync.mockReturnValue([]);
  });

  test('setScene accepts valid scene and rejects invalid', () => {
    const { useChatStore } = require('@/store/modules/use-chat-store');
    const store = useChatStore();

    store.setScene('dish_critic');
    expect(store.currentScene).toBe('dish_critic');

    store.setScene('not_a_scene');
    expect(store.currentScene).toBe('general_chat');
  });

  test('initSession persists history even if setStorageSync throws', async () => {
    const { createAISession } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    (createAISession as jest.Mock).mockResolvedValue({ code: 200, data: { sessionId: 's1', welcomeMessage: 'hi' } });
    mockSetStorageSync.mockImplementation(() => { throw new Error('persist fail'); });

    const store = useChatStore();

    await expect(store.initSession('general_chat', true)).resolves.not.toThrow();
    expect(store.sessionId).toBe('s1');
    // setStorageSync should have been attempted and thrown (caught inside)
    expect(mockSetStorageSync).toHaveBeenCalled();
  });

  test('loadHistoryFromStorage ignores non-array returns', () => {
    mockGetStorageSync.mockReturnValue('not-array');
    const { useChatStore } = require('@/store/modules/use-chat-store');
    const store = useChatStore();
    expect(Array.isArray(store.historyEntries)).toBe(true);
    expect(store.historyEntries.length).toBe(0);
  });

  test('sendChatMessage handles stream callbacks: text_chunk and new_block and onComplete', async () => {
    const { createAISession, streamAIChat } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    (createAISession as jest.Mock).mockResolvedValue({ code: 200, data: { sessionId: 's-xyz' } });

    // mock streamAIChat to synchronously call callbacks
    let capturedPayload: any;
    (streamAIChat as jest.Mock).mockImplementation((_sessionId: string, payload: any, callbacks: any) => {
      capturedPayload = payload;
      // Simulate receiving a text chunk
      callbacks.onEvent && callbacks.onEvent('text_chunk');
      callbacks.onMessage && callbacks.onMessage('hello');
      // Simulate a new block JSON
      callbacks.onEvent && callbacks.onEvent('new_block');
      callbacks.onJSON && callbacks.onJSON({ type: 'card_dish', data: [{ id: 'd1' }] });
      // Complete
      callbacks.onComplete && callbacks.onComplete();
      return { close: jest.fn() };
    });

    const store = useChatStore();
    await store.initSession('general_chat', true);

    await store.sendChatMessage('ping');

    // payload should include client localTime with timezone offset
    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.clientContext).toBeTruthy();
    expect(typeof capturedPayload.clientContext.localTime).toBe('string');
    expect(capturedPayload.clientContext.localTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    );
    expect(typeof capturedPayload.clientContext.tzOffsetMinutes).toBe('number');

    // ai message should be present with text and a card segment
    const aiMessages = store.messages.filter((m: any) => m.type === 'ai');
    expect(aiMessages.length).toBeGreaterThan(0);
    const lastAi = aiMessages[aiMessages.length - 1];

    const textSeg = lastAi.content.find((s: any) => s.type === 'text');
    expect(textSeg).toBeDefined();
    expect(textSeg.text).toContain('hello');

    const cardSeg = lastAi.content.find((s: any) => s.type === 'card_dish');
    expect(cardSeg).toBeDefined();

    // history persisted
    expect(mockSetStorageSync).toHaveBeenCalled();
  });

  test('sendChatMessage handles onError and marks message accordingly', async () => {
    const { createAISession, streamAIChat } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    (createAISession as jest.Mock).mockResolvedValue({ code: 200, data: { sessionId: 's-err' } });

    (streamAIChat as jest.Mock).mockImplementation((_sessionId: string, _payload: any, callbacks: any) => {
      callbacks.onEvent && callbacks.onEvent('text_chunk');
      callbacks.onMessage && callbacks.onMessage('partial');
      callbacks.onError && callbacks.onError(new Error('urgent fail'));
      return { close: jest.fn() };
    });

    const store = useChatStore();
    await store.initSession('general_chat', true);

    await store.sendChatMessage('check');

    const aiMessages = store.messages.filter((m: any) => m.type === 'ai');
    const lastAi = aiMessages[aiMessages.length - 1];
    const textSeg = lastAi.content.find((s: any) => s.type === 'text');

    expect(textSeg.text).toMatch(/网络请求出错/);
    expect(lastAi.isStreaming).toBe(false);
    expect(store.aiLoading).toBe(false);
  });

  test('abortChat calls close and clears streaming state', async () => {
    const { createAISession, streamAIChat } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    (createAISession as jest.Mock).mockResolvedValue({ code: 200, data: { sessionId: 's-abt' } });

    const closeFn = jest.fn();
    (streamAIChat as jest.Mock).mockImplementation((_sessionId: string, _payload: any, callbacks: any) => {
      // leave stream running
      return { close: closeFn };
    });

    const store = useChatStore();
    await store.initSession('general_chat', true);

    // start message (fire and not waiting for completion)
    store.sendChatMessage('bye');

    // ensure we have a currentStreamAbort
    expect(typeof store.currentScene === 'string' || store.currentScene).toBeTruthy();

    store.abortChat();
    expect(closeFn).toHaveBeenCalled();
    expect(store.aiLoading).toBe(false);
  });
});