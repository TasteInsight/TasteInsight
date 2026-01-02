/// <reference types="jest" />

// Mocks must be defined before importing the composable
const chatStoreMock: any = {
  messages: [],
  currentScene: undefined,
  initSession: jest.fn(() => Promise.resolve()),
  startNewSession: jest.fn(() => Promise.resolve()),
  sendChatMessage: jest.fn(() => Promise.resolve()),
  setScene: jest.fn((s: string) => { chatStoreMock.currentScene = s; }),
  aiLoading: false,
  historyEntries: [],
  loadSessionFromHistory: jest.fn((id: string) => true),
};

// Return jest.fn() factories to avoid referencing outer-scope variables in module factory
jest.mock('@/store/modules/use-chat-store', () => ({ useChatStore: jest.fn() }));
jest.mock('@/api/modules/ai', () => ({ getAISuggestions: jest.fn() }));

import { useChat } from '@/pages/ai-chat/composables/use-chat';
import { useChatStore } from '@/store/modules/use-chat-store';
import { getAISuggestions } from '@/api/modules/ai';

describe('useChat isInitializing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Silence Vue onMounted warning in test environment
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Bind mocked functions to return our chatStoreMock and preset getAISuggestions
    (useChatStore as unknown as jest.Mock).mockImplementation(() => chatStoreMock);
    (getAISuggestions as unknown as jest.Mock).mockResolvedValue({ code: 200, data: { suggestions: ['ok'] } });

    chatStoreMock.messages = [];
    chatStoreMock.currentScene = undefined;
    chatStoreMock.loadSessionFromHistory.mockImplementation(() => true);
  });

  it('init sets isInitializing true during init and false afterwards', async () => {
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

  it('resetChat sets isInitializing and calls startNewSession', async () => {
    const { resetChat, isInitializing } = useChat();

    const p = resetChat('arena');
    expect(isInitializing.value).toBe(true);
    expect(chatStoreMock.startNewSession).toHaveBeenCalledWith('arena');

    await p;
    expect(isInitializing.value).toBe(false);
  });

  it('loadHistorySession true path sets isInitializing and returns true', async () => {
    chatStoreMock.loadSessionFromHistory.mockImplementation(() => true);

    const { loadHistorySession, isInitializing } = useChat();
    const p = loadHistorySession('sess1');

    expect(isInitializing.value).toBe(true);

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
    expect((getAISuggestions as unknown as jest.Mock)).not.toHaveBeenCalled();
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
    // getAISuggestions should have been triggered to refresh suggestions (async)
    expect(getAISuggestions).toHaveBeenCalled();
  });

  it('sendMessage logs errors on failure', async () => {
    chatStoreMock.sendChatMessage.mockImplementation(() => { throw new Error('fail'); });
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
