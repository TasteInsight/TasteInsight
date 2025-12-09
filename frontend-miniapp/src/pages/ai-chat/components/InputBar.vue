<template>
  <view class="w-full h-[60px] flex items-center px-3 bg-white rounded-full shadow-lg gap-2 relative">
    <!-- scene 下拉选择器（仅选择） -->
    <picker mode="selector" :range="sceneOptions" range-key="label" :value="scenePickerIndex" @change="handleScenePicker">
      <view class="flex items-center border border-gray-100 rounded-md px-2 py-1.5 mr-2 bg-white">
        <text class="iconify text-gray-600 mr-1.5" data-icon="mdi:tag-outline" data-width="16"></text>
        <text class="text-xs text-gray-700">{{ sceneOptions[scenePickerIndex]?.label || '场景' }}</text>
        <text class="iconify text-gray-500 ml-1" data-icon="mdi:chevron-down" data-width="14"></text>
      </view>
    </picker>
    <input 
      class="flex-1 h-full text-base ml-1" 
      placeholder="请问今天吃什么？" 
      :value="inputText"
      @input="handleMessageInput"
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
const sceneOptions = [
  { value: 'general_chat', label: '普通对话' },
  { value: 'meal_planner', label: '餐单规划' },
  { value: 'dish_critic', label: '菜品点评' }
];
const scenePickerIndex = ref(sceneOptions.findIndex(opt => opt.value === sceneLocal.value) || 0);

const emitScene = () => {
  emit('update:scene', sceneLocal.value);
};

const handleScenePicker = (e: any) => {
  const idx = e.detail.value;
  scenePickerIndex.value = idx;
  sceneLocal.value = sceneOptions[idx].value;
  emitScene();
};

const handleMessageInput = (e: any) => {
  inputText.value = e.detail.value;
};

const handleSceneChange = (e: any) => {
  sceneLocal.value = e.detail.value;
  emitScene();
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
  scenePickerIndex.value = sceneOptions.findIndex(opt => opt.value === sceneLocal.value) || 0;
});
</script>