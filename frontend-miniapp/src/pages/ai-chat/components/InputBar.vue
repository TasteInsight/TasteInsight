<template>
  <view
    class="w-full max-w-md h-[50px] flex items-center px-3 bg-white rounded-full shadow-lg gap-2 relative border border-gray-200"
  >
    <input
      class="flex-1 h-full text-base ml-1"
      placeholder="请问今天吃什么？"
      :value="inputText"
      @input="handleMessageInput"
      :disabled="loading"
      @confirm="handleSend"
    />
    
    <!-- AI 正在回复时显示停止按钮 -->
    <view
      v-if="loading"
      class="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center ml-2.5 cursor-pointer transition-all active:bg-red-600 active:scale-95"
      @tap="handleStop"
    >
      <view class="w-3 h-3 bg-white rounded-sm"></view>
    </view>
    
    <!-- 正常状态显示发送按钮 -->
    <view
      v-else
      class="w-8 h-8 rounded-full bg-ts-purple flex items-center justify-center ml-2.5 cursor-pointer transition-opacity"
      :class="{ 'opacity-50 pointer-events-none': !inputText.trim() }"
      @tap="handleSend"
    >
      <text class="iconfont icon-send text-white" style="font-size: 16px; line-height: 1"></text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'stop'): void;
}>();

const inputText = ref('');

const handleMessageInput = (e: any) => {
  inputText.value = e.detail.value;
};

const handleSend = () => {
  const text = inputText.value.trim();
  if (!text || props.loading) return;

  emit('send', text);
  inputText.value = '';
};

const handleStop = () => {
  console.log('[InputBar] Stop button clicked');
  emit('stop');
};

const setText = (text: string) => {
  inputText.value = text;
};

defineExpose({
  setText,
});
</script>
