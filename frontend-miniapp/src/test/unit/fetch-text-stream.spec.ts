import { ReadableStream as NodeReadableStream } from 'stream/web';
import { TextDecoder as NodeTextDecoder, TextEncoder } from 'util';
import { setImmediate } from 'timers';
import { fetchTextStream } from '@/utils/fetch-text-stream';

const immediate = setImmediate;
const flush = () => new Promise<void>(resolve => immediate(resolve));
const encoder = new TextEncoder();
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const originalDecoder = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder');
let fetchMock: jest.Mock;
const options = () => ({
  url: 'https://api.example.test/ai/sessions/test/chat/stream',
  header: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '午餐推荐' }),
  onStatus: jest.fn(),
  onText: jest.fn(),
  onError: jest.fn(),
  onComplete: jest.fn(),
});
function response(status = 200) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = jest.fn();
  const stream = new NodeReadableStream<Uint8Array>({
    start(value) {
      controller = value as unknown as ReadableStreamDefaultController<Uint8Array>;
    },
    cancel,
  });
  const getReader = jest.spyOn(stream, 'getReader');
  return {
    value: { status, body: stream } as unknown as Response,
    stream,
    controller,
    cancel,
    getReader,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.useFakeTimers();
  fetchMock = jest.fn();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchMock });
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: NodeTextDecoder });
});
afterEach(() => {
  jest.useRealTimers();
  for (const [name, descriptor] of [
    ['fetch', originalFetch],
    ['TextDecoder', originalDecoder],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

test('sends one explicit POST without cookies or redirects and decodes split UTF-8 incrementally', async () => {
  const source = response();
  fetchMock.mockResolvedValue(source.value);
  const callbacks = options();
  fetchTextStream(callbacks);
  await flush();
  const text = '\uFEFFevent: text_chunk\ndata: 中文🍚\n\n';
  for (const byte of encoder.encode(text)) {
    source.controller.enqueue(new Uint8Array([byte]));
    await flush();
  }
  expect(callbacks.onText.mock.calls.map(([part]) => part).join('')).toBe(text.slice(1));
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  source.controller.close();
  await flush();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(callbacks.url, {
    method: 'POST',
    headers: callbacks.header,
    body: callbacks.body,
    credentials: 'omit',
    redirect: 'error',
    signal: expect.any(AbortSignal),
  });
  expect(callbacks.onStatus).toHaveBeenCalledWith(200);
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
  expect(source.stream.locked).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test.each([401, 503])(
  'HTTP %s closes its body before status and never reads, retries or completes it',
  async status => {
    const source = response(status);
    fetchMock.mockResolvedValue(source.value);
    const callbacks = options();
    callbacks.onStatus.mockImplementation(() => {
      expect(source.cancel).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    });
    fetchTextStream(callbacks);
    await flush();
    expect(callbacks.onStatus).toHaveBeenCalledWith(status);
    expect(source.getReader).not.toHaveBeenCalled();
    expect(callbacks.onText).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  }
);

test('a connection timeout aborts once and ignores its later fetch rejection', async () => {
  const pending = deferred<Response>();
  fetchMock.mockReturnValue(pending.promise);
  const callbacks = options();
  fetchTextStream(callbacks);
  jest.advanceTimersByTime(59_999);
  expect(callbacks.onError).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(callbacks.onError.mock.calls[0][0].name).toBe('TimeoutError');
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  pending.reject(new DOMException('Aborted', 'AbortError'));
  await flush();
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('headers and incoming bytes reset the idle timer while a long active stream stays open', async () => {
  const pending = deferred<Response>();
  fetchMock.mockReturnValue(pending.promise);
  const callbacks = options();
  const source = response();
  fetchTextStream(callbacks);
  jest.advanceTimersByTime(59_000);
  pending.resolve(source.value);
  await flush();
  jest.advanceTimersByTime(59_000);
  source.controller.enqueue(encoder.encode('第一段'));
  await flush();
  jest.advanceTimersByTime(59_000);
  source.controller.enqueue(encoder.encode('第二段'));
  await flush();
  expect(callbacks.onError).not.toHaveBeenCalled();
  jest.advanceTimersByTime(60_000);
  await flush();
  expect(callbacks.onText.mock.calls.map(([part]) => part).join('')).toBe('第一段第二段');
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(source.cancel).toHaveBeenCalledTimes(1);
  expect(source.stream.locked).toBe(false);
  expect(callbacks.onComplete).not.toHaveBeenCalled();
});

test('abort immediately suppresses a queued read result and all terminal callbacks', async () => {
  const source = response();
  fetchMock.mockResolvedValue(source.value);
  const callbacks = options();
  const task = fetchTextStream(callbacks);
  await flush();
  source.controller.enqueue(encoder.encode('已经进入读取队列'));
  task.abort();
  task.abort();
  await flush();
  expect(callbacks.onText).not.toHaveBeenCalled();
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(source.cancel).toHaveBeenCalledTimes(1);
  expect(source.stream.locked).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test('a response arriving after abort is cancelled without status or text callbacks', async () => {
  const pending = deferred<Response>();
  fetchMock.mockReturnValue(pending.promise);
  const callbacks = options();
  const task = fetchTextStream(callbacks);
  task.abort();
  const source = response();
  pending.resolve(source.value);
  await flush();
  expect(source.cancel).toHaveBeenCalledTimes(1);
  expect(callbacks.onStatus).not.toHaveBeenCalled();
  expect(callbacks.onText).not.toHaveBeenCalled();
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
});

test('aborting from a successful status callback closes the body before any read starts', async () => {
  const source = response();
  fetchMock.mockResolvedValue(source.value);
  const callbacks = options();
  const task = fetchTextStream(callbacks);
  callbacks.onStatus.mockImplementation(() => task.abort());
  await flush();
  expect(source.getReader).not.toHaveBeenCalled();
  expect(source.cancel).toHaveBeenCalledTimes(1);
  expect(callbacks.onText).not.toHaveBeenCalled();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
});

test('a network interruption reports one error after the delivered prefix without replay', async () => {
  const source = response();
  fetchMock.mockResolvedValue(source.value);
  const callbacks = options();
  fetchTextStream(callbacks);
  await flush();
  source.controller.enqueue(encoder.encode('已收到的前缀'));
  await flush();
  const error = new TypeError('Connection reset');
  source.controller.error(error);
  await flush();
  expect(callbacks.onText).toHaveBeenCalledWith('已收到的前缀');
  expect(callbacks.onError).toHaveBeenCalledWith(error);
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('fetch rejection, including a forbidden redirect, reports an error without replay', async () => {
  const error = new TypeError('Redirect is not allowed');
  fetchMock.mockRejectedValue(error);
  const callbacks = options();
  fetchTextStream(callbacks);
  await flush();
  expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
  expect(callbacks.onError).toHaveBeenCalledWith(error);
  expect(callbacks.onStatus).not.toHaveBeenCalled();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('one stream finishing cannot cancel a different stream or its idle timer', async () => {
  const first = response();
  const second = response();
  fetchMock.mockResolvedValueOnce(first.value).mockResolvedValueOnce(second.value);
  const firstCallbacks = options();
  const secondCallbacks = options();
  fetchTextStream(firstCallbacks);
  await flush();
  jest.advanceTimersByTime(30_000);
  fetchTextStream(secondCallbacks);
  await flush();
  first.controller.close();
  await flush();
  expect(firstCallbacks.onComplete).toHaveBeenCalledTimes(1);
  expect(second.cancel).not.toHaveBeenCalled();
  jest.advanceTimersByTime(59_999);
  expect(secondCallbacks.onError).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  await flush();
  expect(secondCallbacks.onError).toHaveBeenCalledTimes(1);
  expect(firstCallbacks.onError).not.toHaveBeenCalled();
  expect(second.cancel).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('abort inside a text callback suppresses queued later chunks and EOF', async () => {
  const source = response();
  fetchMock.mockResolvedValue(source.value);
  const callbacks = options();
  const task = fetchTextStream(callbacks);
  callbacks.onText.mockImplementation(() => task.abort());
  await flush();
  source.controller.enqueue(encoder.encode('第一段'));
  source.controller.enqueue(encoder.encode('尾段'));
  source.controller.close();
  await flush();
  expect(callbacks.onText).toHaveBeenCalledTimes(1);
  expect(callbacks.onText).toHaveBeenCalledWith('第一段');
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(source.stream.locked).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test('a successful status without a readable body reports one error and releases its idle timer', async () => {
  fetchMock.mockResolvedValue({ status: 200, body: null } as Response);
  const callbacks = options();
  fetchTextStream(callbacks);
  await flush();
  expect(callbacks.onStatus).toHaveBeenCalledWith(200);
  expect(callbacks.onError).toHaveBeenCalledTimes(1);
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
