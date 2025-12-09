<template>
  <view class="w-full h-[60px] flex items-center px-3 bg-white rounded-full shadow-lg gap-2">
    <!-- scene 下拉选择器 -->
    <view class="w-[140px] flex items-center border border-gray-100 rounded-md px-2 py-1 mr-2 bg-white">
      <text class="iconify text-gray-600 mr-2" data-icon="mdi:tag-outline" data-width="18"></text>
      <select
        class="flex-1 h-full text-sm text-gray-700 bg-transparent"
        v-model="sceneLocal"
        @change="emitScene"
      >
        <option value="general_chat">普通对话</option>
        <option value="meal_planner">餐单规划</option>
        <option value="dish_critic">菜品点评</option>
      </select>
    </view>
    <input 
      class="flex-1 h-full text-base ml-1" 
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
import { ref, watch } from 'vue';

const props = defineProps<{
  loading: boolean;
  scene?: string;
}>();

const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'update:scene', value: string): void;
}>();

const inputText = ref('');
const sceneLocal = ref(props.scene || 'general_chat');

const emitScene = () => {
  emit('update:scene', sceneLocal.value);
};

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

// watch prop changes
watch(() => props.scene, (val) => {
  sceneLocal.value = val || 'general_chat';
});
</script>