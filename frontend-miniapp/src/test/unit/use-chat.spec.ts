/// <reference types="jest" />

// Mocks must be defined before importing the composable
const chatStoreMock: any = {
  messages: [],
  currentScene: undefined,
  sessionId: 'test-session',
  initSession: jest.fn(() => Promise.resolve(true)),
  startNewSession: jest.fn(() => Promise.resolve()),
  sendChatMessage: jest.fn(() => Promise.resolve(true)),
  setScene: jest.fn((s: string) => {
    chatStoreMock.currentScene = s;
  }),
  aiLoading: false,
  historyEntries: [],
  loadSessionFromHistory: jest.fn((id: string) => true),
};

// Return jest.fn() factories to avoid referencing outer-scope variables in module factory
jest.mock('@/store/modules/use-chat-store', () => ({ useChatStore: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, userInfo: { id: 'test-user' }, isLoggedIn: true }),
}));
jest.mock('@/api/modules/ai', () => ({ getAISuggestions: jest.fn() }));

import { useChat } from '@/pages/ai-chat/composables/use-chat';
import { useChatStore } from '@/store/modules/use-chat-store';
import { getAISuggestions } from '@/api/modules/ai';
import { flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';

describe('useChat isInitializing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Silence Vue onMounted warning in test environment
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Bind mocked functions to return our chatStoreMock and preset getAISuggestions
    (useChatStore as unknown as jest.Mock).mockImplementation(() => chatStoreMock);
    (getAISuggestions as unknown as jest.Mock).mockResolvedValue({
      code: 200,
      data: { suggestions: ['ok'] },
    });

    chatStoreMock.messages = [];
    chatStoreMock.currentScene = undefined;
    chatStoreMock.sendChatMessage.mockResolvedValue(true);
    chatStoreMock.initSession.mockResolvedValue(true);
    chatStoreMock.loadSessionFromHistory.mockImplementation(() => true);
  });

  it('init sets isInitializing true during init and false afterwards', async () => {
    const sessionStore = reactive(chatStoreMock);
    (useChatStore as unknown as jest.Mock).mockReturnValueOnce(sessionStore);
    sessionStore.sessionId = '';
    chatStoreMock.initSession.mockImplementationOnce(async () => {
      sessionStore.sessionId = 'test-session';
      return true;
    });
    const { init, isInitializing, isInitialLoading } = useChat();

    // Before init, computed should reflect not initialized + empty messages
    expect(isInitialLoading.value).toBe(true);

    const p = init();
    // During init
    expect(isInitializing.value).toBe(true);

    await p;
    // After init
    expect(isInitializing.value).toBe(false);
    expect(isInitialLoading.value).toBe(false);
  });

  it('init failure exposes retry state and send returns acceptance without waiting for suggestions', async () => {
    chatStoreMock.initSession.mockResolvedValueOnce(false);
    const chat = useChat();
    await chat.init();
    expect(chat.initialError.value).toBeTruthy();
    expect(chat.isInitialLoading.value).toBe(false);
    (getAISuggestions as jest.Mock).mockReturnValue(new Promise(() => {}));
    let result: boolean | undefined;
    const pending = chat.sendMessage('午餐').then(value => { result = value; });
    await flushPromises();
    expect(result).toBe(true);
    await pending;
    chatStoreMock.sendChatMessage.mockResolvedValueOnce(false);
    expect(await chat.sendMessage('晚餐')).toBe(false);
  });

  it('resetChat sets isInitializing and calls startNewSession', async () => {
    const { resetChat, isInitializing } = useChat();

    const p = resetChat('arena');
    expect(isInitializing.value).toBe(true);
    expect(chatStoreMock.startNewSession).toHaveBeenCalledWith('arena');

    await p;
    expect(isInitializing.value).toBe(false);
  });

  it('loadHistorySession restores readiness immediately and returns true', async () => {
    chatStoreMock.loadSessionFromHistory.mockImplementation(() => true);

    const { loadHistorySession, isInitializing } = useChat();
    const p = loadHistorySession('sess1');

    expect(isInitializing.value).toBe(false);

    const ok = await p;
    expect(ok).toBe(true);
    expect(isInitializing.value).toBe(false);
    expect(getAISuggestions).toHaveBeenCalled();
  });

  it('loadHistorySession false path returns false and does NOT fetch suggestions', async () => {
    chatStoreMock.loadSessionFromHistory.mockImplementation(() => false);

    const { loadHistorySession, isInitializing } = useChat();

    // Because loadSessionFromHistory is synchronous and returns false, the async function
    // finishes quickly and isInitializing may already be reset when the promise is observed.
    const ok = await loadHistorySession('sess2');
    expect(ok).toBe(false);
    expect(isInitializing.value).toBe(false);
    expect(getAISuggestions as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('fetchSuggestions handles API errors and clears loading flag', async () => {
    (getAISuggestions as unknown as jest.Mock).mockRejectedValue(new Error('boom'));
    const { refreshSuggestions, suggestions } = useChat();

    // call and wait
    await refreshSuggestions();

    // should not throw and loading flag should be reset
    expect(suggestions.value.length).toBe(0);
  });

  it('sendMessage ignores empty or whitespace-only text and calls sendChatMessage otherwise', async () => {
    const { sendMessage } = useChat();

    await sendMessage('   ');
    expect(chatStoreMock.sendChatMessage).not.toHaveBeenCalled();

    await sendMessage('hello');
    expect(chatStoreMock.sendChatMessage).toHaveBeenCalledWith('hello');
    expect(getAISuggestions).not.toHaveBeenCalled();
  });

  it('uses message-owned follow-ups for an existing conversation, without fetching generic suggestions', async () => {
    chatStoreMock.messages = [
      { type: 'user', content: [{ type: 'text', text: '清淡午餐' }] },
      { type: 'ai', content: [{ type: 'text', text: '香菇鸡肉饭' }], suggestions: ['在哪个窗口？'] },
    ];
    const chat = useChat();
    await chat.init();
    expect(chat.suggestions.value).toEqual(['在哪个窗口？']);
    expect(getAISuggestions).not.toHaveBeenCalled();
  });

  it('does not replace missing follow-ups with opening templates after an answer', async () => {
    chatStoreMock.messages = [{ type: 'user' }, { type: 'ai', content: [] }];
    const chat = useChat();
    await chat.init();
    expect(chat.suggestions.value).toEqual([]);
    expect(getAISuggestions).not.toHaveBeenCalled();
  });

  it('sendMessage logs errors on failure', async () => {
    chatStoreMock.sendChatMessage.mockImplementation(() => {
      throw new Error('fail');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { sendMessage } = useChat();

    await sendMessage('willfail');

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('handleSuggestionClick forwards to sendMessage', async () => {
    const { handleSuggestionClick } = useChat();
    await handleSuggestionClick('suggest');
    expect(chatStoreMock.sendChatMessage).toHaveBeenCalledWith('suggest');
  });

  it('setScene calls store.setScene and updates scene ref', () => {
    const { setScene, scene } = useChat();
    setScene('arena');
    expect(chatStoreMock.setScene).toHaveBeenCalledWith('arena');
    expect(scene.value).toBe(chatStoreMock.currentScene);
  });

  it('init with scene param calls setScene and may skip initSession when messages exist', async () => {
    // messages empty -> initSession called
    chatStoreMock.messages = [];
    const { init } = useChat();
    await init('new');
    expect(chatStoreMock.initSession).toHaveBeenCalled();

    // messages non-empty -> do not call initSession
    chatStoreMock.initSession.mockClear();
    chatStoreMock.messages = [{}];
    await init('new2');
    expect(chatStoreMock.initSession).not.toHaveBeenCalled();
  });
});
