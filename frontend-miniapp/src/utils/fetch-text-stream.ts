import type { TextStreamOptions, TextStreamTask } from '@/utils/text-stream';

export function fetchTextStream(options: TextStreamOptions): TextStreamTask {
  const controller = new AbortController();
  let body: ReadableStream<Uint8Array> | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let ended = false;

  const finish = () => {
    ended = true;
    clearTimeout(idleTimer);
    idleTimer = undefined;
  };
  const closeBody = () => {
    if (reader) {
      const current = reader;
      reader = null;
      body = null;
      void current
        .cancel()
        .catch(() => {})
        .then(() => current.releaseLock());
    } else if (body) {
      void body.cancel().catch(() => {});
      body = null;
    }
    controller.abort();
  };
  const fail = (cause: unknown) => {
    if (ended) return;
    finish();
    closeBody();
    options.onError(cause instanceof Error ? cause : new Error(String(cause)));
  };
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const error = new Error('Stream connection timed out');
      error.name = 'TimeoutError';
      fail(error);
    }, 60_000);
  };
  const abort = () => {
    if (ended) return;
    finish();
    closeBody();
  };

  async function read() {
    resetIdleTimer();
    try {
      const response = await fetch(options.url, {
        method: 'POST',
        headers: options.header,
        body: options.body,
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      if (ended) {
        void response.body?.cancel().catch(() => {});
        return;
      }
      body = response.body;
      if (response.status < 200 || response.status >= 300) {
        finish();
        closeBody();
        options.onStatus(response.status);
        return;
      }
      resetIdleTimer();
      options.onStatus(response.status);
      if (ended) return;
      if (!body) throw new Error('Response stream is unavailable');
      const current = body.getReader();
      reader = current;
      const decoder = new TextDecoder('utf-8');
      while (!ended) {
        const { done, value } = await current.read();
        if (ended) return;
        if (done) {
          const remainder = decoder.decode();
          if (remainder) options.onText(remainder);
          if (ended) return;
          finish();
          options.onComplete();
          return;
        }
        if (value.byteLength) {
          resetIdleTimer();
          const text = decoder.decode(value, { stream: true });
          if (text) options.onText(text);
        }
      }
    } catch (cause) {
      fail(cause);
    } finally {
      if (reader) {
        reader.releaseLock();
        reader = null;
      }
      body = null;
    }
  }
  void read();
  return { abort };
}
