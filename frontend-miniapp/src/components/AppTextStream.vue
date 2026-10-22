<template>
  <!-- renderjs 模块由 App 编译器注入。 -->
  <!-- 对象封装让取消状态通过 App 视图桥的属性更新触发 renderjs。 -->
  <!-- @vue-expect-error -->
  <view
    class="app-text-stream"
    aria-hidden="true"
    :request="{ value: request }"
    :change:request="stream.update"
  />
</template>

<script lang="ts">
import { defineComponent, markRaw } from 'vue';
import type { TextStreamOptions, TextStreamTask } from '@/utils/text-stream';

type StreamRequest = { id: number; url: string; header: Record<string, string>; body: string };
type StreamEvent =
  | { id: number; type: 'status'; status: number }
  | { id: number; type: 'text'; text: string }
  | { id: number; type: 'error'; message: string }
  | { id: number; type: 'complete' };

// renderjs 的 callMethod 通过 Options API methods 回到逻辑层。
export default defineComponent({
  name: 'AppTextStream',
  data() {
    return {
      request: null as StreamRequest | null,
      active: null as { id: number; callbacks: TextStreamOptions } | null,
      sequence: 0,
    };
  },
  beforeUnmount() {
    this.cancel();
  },
  methods: {
    start(options: TextStreamOptions): TextStreamTask {
      this.cancel();
      const id = ++this.sequence;
      this.active = markRaw({ id, callbacks: options });
      this.request = { id, url: options.url, header: options.header, body: options.body };
      return {
        abort: () => {
          if (this.active?.id === id) this.cancel();
        },
      };
    },
    cancel() {
      this.active = null;
      this.request = null;
    },
    receive(event: StreamEvent) {
      const active = this.active;
      if (!active || active.id !== event.id) return;
      if (
        event.type === 'error' ||
        event.type === 'complete' ||
        (event.type === 'status' && (event.status < 200 || event.status >= 300))
      ) {
        this.cancel();
      }
      if (event.type === 'status') active.callbacks.onStatus(event.status);
      else if (event.type === 'text') active.callbacks.onText(event.text);
      else if (event.type === 'error') active.callbacks.onError(new Error(event.message));
      else active.callbacks.onComplete();
    },
  },
});
</script>

<script module="stream" lang="renderjs">
import { fetchTextStream } from '@/utils/fetch-text-stream';

export default {
  beforeUnmount() {
    this.streamTask?.abort();
    this.streamTask = null;
  },
  methods: {
    update({ value: request }) {
      this.streamTask?.abort();
      this.streamTask = null;
      if (!request) return;
      const send = event => this.$ownerInstance.callMethod('receive', { id: request.id, ...event });
      this.streamTask = fetchTextStream({
        url: request.url,
        header: request.header,
        body: request.body,
        onStatus: status => send({ type: 'status', status }),
        onText: text => send({ type: 'text', text }),
        onError: error => send({ type: 'error', message: error.message }),
        onComplete: () => send({ type: 'complete' }),
      });
    },
  },
};
</script>

<style scoped>
.app-text-stream {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
