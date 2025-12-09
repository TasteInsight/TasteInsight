<template>
  <view class="w-full h-[60px] flex items-center px-3 bg-white rounded-full shadow-lg gap-2 relative">
    <!-- scene 可输入的下拉选择器 -->
    <view class="w-[160px] flex items-center border border-gray-100 rounded-md px-2 py-1 mr-2 bg-white relative" @click="toggleSceneOptions">
      <text class="iconify text-gray-600 mr-2" data-icon="mdi:tag-outline" data-width="18"></text>
      <input
        class="flex-1 h-full text-sm text-gray-700 bg-transparent"
        :value="sceneLocal"
        placeholder="scene"
        @input="handleSceneInput"
        @focus="openSceneOptions"
        @confirm="emitScene"
        @click.stop
      />
      <text class="iconify text-gray-500" :data-icon="showSceneOptions ? 'mdi:chevron-up' : 'mdi:chevron-down'" data-width="16"></text>
      <view v-if="showSceneOptions" class="absolute top-full left-0 mt-2 w-full bg-white border border-gray-100 rounded-lg shadow-lg z-50">
        <view v-for="opt in sceneOptions" :key="opt.value" class="px-3 py-2 active:bg-gray-100" @click.stop="selectScene(opt.value)">
          <text class="text-sm text-gray-800">{{ opt.label }}</text>
        </view>
      </view>
    </view>
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
const showSceneOptions = ref(false);
const sceneOptions = [
  { value: 'general_chat', label: '普通对话' },
  { value: 'meal_planner', label: '餐单规划' },
  { value: 'dish_critic', label: '菜品点评' }
];

const emitScene = () => {
  emit('update:scene', sceneLocal.value);
};

const handleSceneInput = (e: any) => {
  sceneLocal.value = e.detail.value;
  emitScene();
};

const handleMessageInput = (e: any) => {
  inputText.value = e.detail.value;
};

const selectScene = (val: string) => {
  sceneLocal.value = val;
  emitScene();
  showSceneOptions.value = false;
};

const openSceneOptions = () => {
  showSceneOptions.value = true;
};

const toggleSceneOptions = () => {
  showSceneOptions.value = !showSceneOptions.value;
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
});
</script>