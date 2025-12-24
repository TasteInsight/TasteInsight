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

  test('streamAIChat processes event lines and non-json data', async () => {
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    let savedOnChunk: any = null;
    let savedComplete: any = null;

    (global as any).uni = {
      request: (opts: any) => {
        opts.success && opts.success({});
        savedComplete = opts.complete;
        return {
          onChunkReceived: (cb: any) => { savedOnChunk = cb; },
          abort: jest.fn(),
        };
      },
    };

    const onEvent = jest.fn();
    const onMessage = jest.fn();
    const onJSON = jest.fn();

    const { streamAIChat } = require(MODULE_PATH);
    streamAIChat('s1', { prompt: 'x' } as any, { onEvent, onMessage, onJSON });

    const buf = Buffer.from('event: progress\ndata: hello\n\n');
    const arr = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    savedOnChunk({ data: arr });
    savedComplete && savedComplete();

    expect(onEvent).toHaveBeenCalledWith('progress');
    expect(onMessage).toHaveBeenCalledWith('hello');
    expect(onJSON).not.toHaveBeenCalled();
  });

  test('streamAIChat falls back to utf8 decoder and handles split multibyte chunks', async () => {
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    let savedOnChunk: any = null;
    let savedComplete: any = null;

    (global as any).uni = {
      request: (opts: any) => {
        opts.success && opts.success({});
        savedComplete = opts.complete;
        return {
          onChunkReceived: (cb: any) => { savedOnChunk = cb; },
          abort: jest.fn(),
        };
      },
    };

    // remove TextDecoder to force fallback
    (global as any).TextDecoder && delete (global as any).TextDecoder;

    const onMessage = jest.fn();
    const onJSON = jest.fn();
    const onComplete = jest.fn();

    const { streamAIChat } = require(MODULE_PATH);
    streamAIChat('s1', { prompt: 'x' } as any, { onMessage, onJSON, onComplete });

    const full = Buffer.from('data: {"a":"€"}\n\n');
    // find byte index of euro sign and split inside its bytes
    const euroIndex = full.indexOf('€');
    const splitAt = euroIndex + 1; // split inside multibyte code unit
    const first = full.slice(0, splitAt);
    const second = full.slice(splitAt);

    const firstBuf = first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength);
    const secondBuf = second.buffer.slice(second.byteOffset, second.byteOffset + second.byteLength);
    savedOnChunk({ data: firstBuf });
    savedOnChunk({ data: secondBuf });

    savedComplete && savedComplete();

    expect(onMessage).toHaveBeenCalled();
    expect(onJSON).toHaveBeenCalledWith({ a: '€' });
    expect(onComplete).toHaveBeenCalled();
  });
});