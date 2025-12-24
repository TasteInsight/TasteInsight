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

  test('streamAIChat accepts string chunks and non-arraybuffer data', async () => {
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

    const onMessage = jest.fn();
    const onJSON = jest.fn();

    const { streamAIChat } = require(MODULE_PATH);
    streamAIChat('s1', { prompt: 'str' } as any, { onMessage, onJSON });

    // simulate SDK returning a string payload instead of ArrayBuffer
    savedOnChunk({ data: 'data: hello\n\n' });
    savedComplete && savedComplete();

    expect(onMessage).toHaveBeenCalledWith('hello');
    expect(onJSON).not.toHaveBeenCalled();
  });

  test('streamAIChat propagates request failure via onError', async () => {
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    let savedFail: any = null;

    (global as any).uni = {
      request: (opts: any) => {
        savedFail = opts.fail;
        return { onChunkReceived: () => {}, abort: jest.fn() };
      },
    };

    const onError = jest.fn();
    const { streamAIChat } = require(MODULE_PATH);
    streamAIChat('s1', { prompt: 'err' } as any, { onError });

    // simulate fail callback
    savedFail && savedFail({ message: 'network' });

    expect(onError).toHaveBeenCalledWith({ message: 'network' });
  });

  test('streamAIChat close() aborts the request task', async () => {
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 'tok' }) }));

    let savedOnChunk: any = null;

    const abortFn = jest.fn();

    (global as any).uni = {
      request: (opts: any) => {
        opts.success && opts.success({});
        return { onChunkReceived: (cb: any) => { savedOnChunk = cb; }, abort: abortFn };
      },
    };

    const { streamAIChat } = require(MODULE_PATH);
    const handle = streamAIChat('s1', { prompt: 'close' } as any, {});

    handle.close();

    expect(abortFn).toHaveBeenCalled();
  });

  test('streamAIChat preserves partial buffers across chunks', async () => {
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

    const onMessage = jest.fn();

    const { streamAIChat } = require(MODULE_PATH);
    streamAIChat('s1', { prompt: 'p' } as any, { onMessage });

    // ensure TextEncoder exists
    if (typeof TextEncoder === 'undefined') {
      const { TextEncoder } = require('util');
      (global as any).TextEncoder = TextEncoder;
    }

    const encoder = new TextEncoder();
    // first chunk contains a full event and the beginning of the second
    const part1 = encoder.encode('data: 1\n\n' + 'data: pa').buffer;
    const part2 = encoder.encode('rtial\n\n').buffer;

    savedOnChunk({ data: part1 });
    savedOnChunk({ data: part2 });
    savedComplete && savedComplete();

    expect(onMessage).toHaveBeenCalled();
    // first call with '1', second with 'partial'
    expect(onMessage.mock.calls[0][0]).toBe('1');
    expect(onMessage.mock.calls[1][0]).toBe('partial');
  });
});