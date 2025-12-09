<template>
  <view class="flex flex-col h-screen relative bg-gray-100">
    <!-- 骨架屏：首次加载时显示 -->
    <AIChatSkeleton v-if="isInitialLoading" />

    <template v-else>
    <view class="h-14 flex items-center justify-center px-4 bg-white border-b border-gray-200 relative">
        <text class="text-lg font-semibold text-gray-800">问AI</text>
        <view class="absolute top-2.5 right-4 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm text-gray-600 flex items-center" @click="alertHistory">
          <text class="iconify mr-1" data-icon="mdi:history" data-width="16"></text>
          历史记录
        </view>
    </view>
    
    <scroll-view 
      scroll-y 
      class="flex-1 p-4 pb-[160px]" 
      :scroll-into-view="scrollViewId"
      @scroll="handleScroll"
    >
      <!-- AI 聊天消息列表 -->
      <view v-for="message in messages" :key="message.id" :id="`msg-${message.id}`" class="mb-4">
        <!-- 遍历消息段 -->
        <view v-for="(segment, index) in message.content" :key="index" class="mb-2">
          
          <!-- 文本段 -->
          <view v-if="segment.type === 'text'" 
            class="py-2.5 px-4 rounded-2xl max-w-[80%] text-base"
            :class="[message.type === 'user' ? 'bg-ts-purple text-white ml-auto rounded-br-sm' : 'bg-gray-200 text-gray-800 mr-auto rounded-bl-sm']"
          >
            {{ segment.text }}
            <text v-if="message.isStreaming && index === message.content.length - 1" class="animate-pulse">...</text>
          </view>

          <!-- 菜品卡片 -->
          <view v-else-if="segment.type === 'card_dish'" class="w-full">
             <DishCard v-for="(dish, i) in segment.data" :key="i" :dish="dish" />
          </view>

          <!-- 规划卡片 -->
          <view v-else-if="segment.type === 'card_plan'" class="w-full">
             <PlanningCard 
               v-for="(plan, i) in segment.data" 
               :key="i" 
               :plan="plan" 
               @apply="handleApplyPlan"
               @discard="handleDiscardPlan"
             />
          </view>

          <!-- 食堂卡片 -->
          <view v-else-if="segment.type === 'card_canteen'" class="w-full">
             <CanteenCard v-for="(canteen, i) in segment.data" :key="i" :canteen="canteen" />
          </view>

          <!-- 窗口卡片 -->
          <view v-else-if="segment.type === 'card_window'" class="w-full">
             <WindowCard v-for="(window, i) in segment.data" :key="i" :window="window" />
          </view>

        </view>
      </view>
      
      <!-- 滚动锚点 -->
      <view :id="scrollAnchorId" class="h-px"></view>
    </scroll-view>

    <!-- 快捷提示词 -->
    <view class="absolute bottom-[160px] left-0 right-0 z-10">
       <SuggestionChips :suggestions="suggestions" @select="handleSuggestionSelect" />
    </view>

    <!-- 底部输入框 -->
    <InputBar ref="inputBarRef" :loading="aiLoading" @send="handleSend" />
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useChat } from './composables/use-chat';
import DishCard from './components/DishCard.vue';
import PlanningCard from './components/PlanningCard.vue';
import CanteenCard from './components/CanteenCard.vue';
import WindowCard from './components/WindowCard.vue';
import InputBar from './components/InputBar.vue';
import SuggestionChips from './components/SuggestionChips.vue';
import { AIChatSkeleton } from '@/components/skeleton';
import type { ComponentMealPlanDraft } from '@/types/api';

const { 
  messages, 
  aiLoading, 
  suggestions, 
  isInitialLoading, 
  sendMessage,
  handleSuggestionClick 
} = useChat();

const scrollAnchorId = 'chat-bottom-anchor';
const scrollViewId = ref(scrollAnchorId);
const inputBarRef = ref<InstanceType<typeof InputBar> | null>(null);

// 监听消息变化，自动滚动到底部
watch(() => messages.value.length, () => {
  setTimeout(() => {
    scrollViewId.value = ''; 
    scrollViewId.value = scrollAnchorId;
  }, 50); 
}, { deep: true });

// 监听流式消息内容变化
watch(() => {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.isStreaming) {
        return lastMsg.content.length; 
    }
    return 0;
}, () => {
    setTimeout(() => {
        scrollViewId.value = ''; 
        scrollViewId.value = scrollAnchorId;
    }, 50);
});

const handleSend = (text: string) => {
  sendMessage(text);
};

const handleSuggestionSelect = (text: string) => {
  if (inputBarRef.value) {
    inputBarRef.value.setText(text);
  }
};

const alertHistory = () => {
  uni.showToast({ title: '查看历史记录 (功能待实现)', icon: 'none' });
};

const handleApplyPlan = (plan: ComponentMealPlanDraft) => {
  uni.showToast({ title: '正在应用规划...', icon: 'loading' });
  setTimeout(() => {
      uni.showToast({ title: '规划已应用', icon: 'success' });
  }, 1000);
};

const handleDiscardPlan = () => {
    uni.showToast({ title: '已放弃规划', icon: 'none' });
};

const handleScroll = (e : Event) => {
};
</script>

<style scoped>
/* Tailwind classes handle most styles */
</style>