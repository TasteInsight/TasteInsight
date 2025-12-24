import { jest } from '@jest/globals';

describe('api/modules/ai.ts', () => {
  const MODULE_PATH = '@/api/modules/ai';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
    delete (global as any).TextEncoder;
  });

  test('getAIRecommendation posts payload', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getAIRecommendation } = require(MODULE_PATH);
    const payload = { userId: 'u' };
    await getAIRecommendation(payload as any);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/ai/recommend',
      method: 'POST',
      data: payload,
    });
  });

  test('getAIHistory GETs with cursor when provided', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getAIHistory } = require(MODULE_PATH);
    await getAIHistory('s1', 'c');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/ai/sessions/s1/history',
      method: 'GET',
      data: { cursor: 'c' },
    });
  });

  test('streamAIChat handles chunked JSON and calls callbacks', async () => {
    // Mock useUserStore to provide token
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    let savedOnChunk: any = null;
    let savedComplete: any = null;

    (global as any).uni = {
      request: (opts: any) => {
        // call success to simulate connection established
        opts.success && opts.success({});
        savedComplete = opts.complete;
        return {
          onChunkReceived: (cb: any) => {
            savedOnChunk = cb;
          },
          abort: jest.fn(),
        };
      },
    };

    // ensure TextEncoder exists in this env
    if (typeof TextEncoder === 'undefined') {
      // Node may expose TextEncoder via util
      const { TextEncoder } = require('util');
      (global as any).TextEncoder = TextEncoder;
    }

    const onMessage = jest.fn();
    const onJSON = jest.fn();
    const onComplete = jest.fn();

    const { streamAIChat } = require(MODULE_PATH);
    const handle = streamAIChat('s1', { prompt: 'hi' } as any, { onMessage, onJSON, onComplete });

    // simulate receiving a chunk (ArrayBuffer)
    const encoder = new TextEncoder();
    const buf = encoder.encode('data: {"a":1}\n\n').buffer;
    // call the saved chunk handler
    savedOnChunk({ data: buf });

    // call complete to flush remaining buffer and trigger onComplete
    savedComplete && savedComplete();

    expect(onMessage).toHaveBeenCalled();
    expect(onJSON).toHaveBeenCalledWith({ a: 1 });
    expect(onComplete).toHaveBeenCalled();

    // close handle should be available
    expect(handle).toHaveProperty('close');
  });
});