/// <reference types="jest" />
import { setActivePinia, createPinia } from 'pinia';

const mockGetStorageSync = jest.fn();
const mockSetStorageSync = jest.fn();

(global as any).uni = {
  getStorageSync: mockGetStorageSync,
  setStorageSync: mockSetStorageSync,
};

jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  streamAIChat: jest.fn(),
  submitRecommendFeedback: jest.fn(),
}));

// Avoid mock adapter side effects
jest.mock('@/mock/mock-adapter', () => ({
  USE_MOCK: false,
}));

describe('useChatStore integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockGetStorageSync.mockReturnValue([]);
  });

  it('initSession: should create session and append welcome message', async () => {
    const { createAISession } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    (createAISession as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        sessionId: 's1',
        welcomeMessage: '欢迎来到 AI 聊天',
      },
    });

    const store = useChatStore();
    await store.initSession('general_chat', true);

    expect(store.sessionId).toBe('s1');
    expect(store.messages.length).toBeGreaterThan(0);
    expect(store.messages[0].type).toBe('ai');
    expect(store.messages[0].content[0]).toEqual({ type: 'text', text: '欢迎来到 AI 聊天' });

    // Should persist history
    expect(mockSetStorageSync).toHaveBeenCalled();
  });

  it('setScene: should fall back to general_chat on invalid scene', async () => {
    const { useChatStore } = require('@/store/modules/use-chat-store');
    const store = useChatStore();

    store.setScene('invalid_scene');
    expect(store.currentScene).toBe('general_chat');
  });
});
