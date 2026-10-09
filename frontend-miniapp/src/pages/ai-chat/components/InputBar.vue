<template>
  <view class="chat-input-bar">
    <!-- #ifdef H5 -->
    <component
      :is="'textarea'"
      v-if="isH5"
      ref="textareaRef"
      class="chat-input"
      aria-label="消息输入"
      placeholder="聊聊口味，或问问今天吃什么"
      :value="modelValue"
      :maxlength="2000"
      rows="1"
      enterkeyhint="send"
      :style="{ height: textareaHeight + 'px' }"
      @input="handleNativeInput"
      @keydown="handleComposerKeydown"
      @keyup="handleComposerKeyup"
      @compositionstart="
        composing = true;
        composerPressed = false;
      "
      @compositionend="composing = false"
      @focus="emit('focus')"
      @blur="
        composerPressed = false;
        emit('blur');
      "
    />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <textarea
      v-if="!isH5"
      class="chat-input chat-input-native"
      aria-label="消息输入"
      placeholder="聊聊口味，或问问今天吃什么"
      :value="modelValue"
      :maxlength="2000"
      :auto-height="false"
      :style="{ height: nativeTextareaHeight + 'px' }"
      :adjust-position="true"
      :cursor-spacing="16"
      confirm-type="send"
      @input="handleMessageInput"
      @linechange="handleNativeLinechange"
      @confirm="handleSend"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <!-- #endif -->
    <button
      class="chat-input-action"
      hover-class="chat-input-action-pressed"
      :hover-stay-time="80"
      :class="{ 'chat-input-action-stop': loading }"
      role="button"
      tabindex="0"
      :aria-label="loading ? '停止回复' : busy ? '正在连接' : '发送消息'"
      :aria-busy="busy"
      :disabled="!loading && (busy || !modelValue.trim())"
      @click="loading ? emit('stop') : handleSend()"
      @keydown="handleKeydown"
      @keyup="handleKeyup"
      @blur="pressed = false"
    >
      <image
        class="chat-send-icon"
        :src="loading ? '/static/icons/stop.png' : '/static/icons/send.png'"
        aria-hidden="true"
      />
    </button>
  </view>
</template>
<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
const props = withDefaults(
  defineProps<{ modelValue: string; loading: boolean; busy?: boolean }>(),
  { busy: false }
);
const emit = defineEmits<{
  (e: 'update:modelValue', text: string): void;
  (e: 'send', text: string): void;
  (e: 'stop'): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
}>();
const pressed = ref(false);
let isH5 = false;
// #ifdef H5
isH5 = true;
// #endif
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const textareaHeight = ref(44);
const nativeTextareaHeight = ref(44);
const handleNativeLinechange = (event: { detail: { lineCount: number } }) => {
  nativeTextareaHeight.value = Math.max(44, Math.min(4, event.detail.lineCount) * 22 + 22);
};
const composing = ref(false);
const composerPressed = ref(false);
const resizeTextarea = () => {
  const field = textareaRef.value;
  if (!field) return;
  field.style.height = '44px';
  textareaHeight.value = Math.min(110, Math.max(44, field.scrollHeight));
  field.style.height = `${textareaHeight.value}px`;
};
watch(
  () => props.modelValue,
  () => nextTick(resizeTextarea)
);
onMounted(resizeTextarea);
const handleNativeInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
  resizeTextarea();
};
const handleComposerKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return;
  if (event.shiftKey || event.isComposing || composing.value) {
    composerPressed.value = false;
    return;
  }
  event.preventDefault();
  composerPressed.value = true;
};
const handleComposerKeyup = (event: KeyboardEvent) => {
  if (
    event.key !== 'Enter' ||
    event.shiftKey ||
    event.isComposing ||
    composing.value ||
    !composerPressed.value
  )
    return;
  event.preventDefault();
  composerPressed.value = false;
  handleSend();
};
const handleMessageInput = (event: any) => emit('update:modelValue', event.detail.value);
const handleSend = () => {
  const text = props.modelValue.trim();
  if (text && !props.loading && !props.busy) emit('send', text);
};
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  pressed.value = true;
};
const handleKeyup = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (!pressed.value) return;
  pressed.value = false;
  if (props.loading) emit('stop');
  else handleSend();
};
</script>
<style scoped>
.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px 6px 18px;
  border: none;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(31, 41, 55, 0.1);
}
.chat-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  min-height: 44px;
  max-height: 110px;
  width: 100%;
  box-sizing: border-box;
  padding: 11px 0;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  line-height: 22px;
  color: #1f2937;
  font-size: 16px;
  caret-color: #660874;
}
.chat-input::placeholder {
  color: #667085;
  opacity: 1;
}
.chat-input:focus-visible {
  outline: none;
}
.chat-input-bar:focus-within {
  box-shadow: 0 4px 16px rgba(31, 41, 55, 0.14);
}
.chat-input-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  width: 44px;
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 50%;
  background: #660874;
  color: #fff;
  font-size: 14px;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 140ms ease-out;
}
.chat-input-action::after {
  border: none;
}
.chat-input-action[disabled] {
  background: #667085;
  opacity: 0.55;
}
.chat-send-icon {
  width: 20px;
  height: 20px;
}
.chat-input-action-stop {
  background: #f4f4f5;
}
.chat-input-action.chat-input-action-pressed:not([disabled]):not(.chat-input-action-stop) {
  background: #50065b;
}
.chat-input-action-stop.chat-input-action-pressed {
  background: #e5e7eb;
}
@media (hover: hover) {
  .chat-input-action:not([disabled]):not(.chat-input-action-stop):hover {
    background: #50065b;
  }
  .chat-input-action-stop:hover {
    background: #e5e7eb;
  }
}
.chat-input-action:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
