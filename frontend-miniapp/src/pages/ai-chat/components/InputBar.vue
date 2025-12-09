<template>
  <view class="absolute bottom-[92px] left-4 right-4 h-[60px] flex items-center px-4 bg-white rounded-full shadow-lg z-10">
    <input 
      class="flex-1 h-full text-base" 
      placeholder="请问今天吃什么？" 
      v-model="inputText" 
      :disabled="loading"
      @confirm="handleSend" 
    />
    <view 
      class="w-8 h-8 rounded-full bg-ts-purple flex items-center justify-center ml-2.5 cursor-pointer transition-opacity" 
      :class="{ 'opacity-50 pointer-events-none': !inputText.trim() || loading }"
      @click="handleSend"
    >
      <text class="iconify text-white" data-icon="mdi:send" data-width="16"></text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', text: string): void;
}>();

const inputText = ref('');

const handleSend = () => {
  const text = inputText.value.trim();
  if (!text || props.loading) return;
  
  emit('send', text);
  inputText.value = '';
};

const setText = (text: string) => {
  inputText.value = text;
};

defineExpose({
  setText
});
</script>