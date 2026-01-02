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

// We'll control mock-adapter to enable USE_MOCK behavior
jest.mock('@/mock/mock-adapter', () => ({ USE_MOCK: true }));

jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  streamAIChat: jest.fn(),
  submitRecommendFeedback: jest.fn(),
}));

describe('useChatStore streaming and feedback (integration)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockGetStorageSync.mockReturnValue([]);
  });

  test('sendChatMessage with USE_MOCK produces streaming text and persists history', async () => {
    const { createAISession } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    (createAISession as jest.Mock).mockResolvedValue({ code: 200, data: { sessionId: 's1' } });

    const store = useChatStore();
    // use fake timers to drive the mock stream's interval
    jest.useFakeTimers();

    await store.initSession('general_chat', true);

    const p = store.sendChatMessage('hello');

    // Fast-forward a few intervals to accumulate chunks
    jest.advanceTimersByTime(500);

    // Allow microtasks to flush
    await Promise.resolve();

    expect(store.messages.length).toBeGreaterThanOrEqual(2);

    const aiMsg = store.messages.find((m: any) => m.type === 'ai');
    expect(aiMsg).toBeDefined();
    // The mock stream should have appended some text
    expect(aiMsg?.content[0]).toHaveProperty('text');

    // After stream ends, history should be persisted
    // Advance enough to finish the stream
    jest.runAllTimers();
    await p;

    expect(mockSetStorageSync).toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('abortChat stops stream and marks last message as not streaming', async () => {
    const { createAISession } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    (createAISession as jest.Mock).mockResolvedValue({ code: 200, data: { sessionId: 's2' } });

    const store = useChatStore();
    jest.useFakeTimers();

    await store.initSession('general_chat', true);

    const p = store.sendChatMessage('hi');
    jest.advanceTimersByTime(200);

    // abort
    store.abortChat();

    // last message should not be streaming
    const last = store.messages[store.messages.length - 1];
    expect(last.isStreaming).toBe(false);
    expect(store.aiLoading).toBe(false);

    jest.useRealTimers();
  });

  test('submitFeedback shows success and error toasts based on response', async () => {
    const { submitRecommendFeedback } = require('@/api/modules/ai');
    const { useChatStore } = require('@/store/modules/use-chat-store');

    const store = useChatStore();

    (submitRecommendFeedback as jest.Mock).mockResolvedValueOnce({ code: 200 });
    await store.submitFeedback({ sessionId: 's', feedback: [] } as any);
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '反馈成功' }));

    (submitRecommendFeedback as jest.Mock).mockResolvedValueOnce({ code: 500, message: 'Bad' });
    await store.submitFeedback({ sessionId: 's', feedback: [] } as any);
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bad' }));

    (submitRecommendFeedback as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    await store.submitFeedback({ sessionId: 's', feedback: [] } as any);
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '提交反馈失败' }));
  });
});