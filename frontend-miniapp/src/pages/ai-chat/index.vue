<template>
  <view class="flex flex-col h-screen bg-gray-50">
    <!-- 骨架屏：首次加载时显示 -->
    <AIChatSkeleton v-if="isInitialLoading" />

    <template v-else>
      <!-- 顶部导航栏 -->
      <view 
        class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex justify-between items-center shadow-sm transition-all duration-300"
        :style="{ paddingTop: (safeAreaInsets?.top || 0) + 'px' }"
      >
         <view class="flex-1 flex items-center justify-between">
            <view class="flex items-center space-x-2">
              <text class="text-lg font-medium text-gray-800">问AI</text>
              <view class="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100">
                <text class="text-xs text-purple-700">{{ sceneBadge }}</text>
              </view>
            </view>
            <view class="flex items-center justify-center flex-1">
              <view class="flex items-center space-x-3">
                <!-- 新建对话 -->
                <view 
                  class="flex items-center space-x-2 bg-gray-100 active:bg-gray-200 px-5 py-2.5 rounded-full transition-all cursor-pointer"
                  @click="handleNewChat"
                >
                   <text class="iconify text-ts-purple" data-icon="mdi:plus-circle" data-width="20"></text>
                   <text class="text-sm font-medium text-gray-700">新建对话</text>
                </view>
                
                <!-- 历史记录 -->
                <view 
                  class="flex items-center space-x-2 bg-gray-100 active:bg-gray-200 px-5 py-2.5 rounded-full transition-all cursor-pointer"
                  @click="openHistory"
                >
                   <text class="iconify text-gray-500" data-icon="mdi:history" data-width="20"></text>
                   <text class="text-sm font-medium text-gray-700">历史记录</text>
                </view>
              </view>
            </view>
            <view class="flex items-center space-x-2">
              <view class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                <text class="iconify text-gray-500" data-icon="mdi:dots-vertical" data-width="18"></text>
              </view>
            </view>
         </view>
      </view>
    
      <!-- 聊天区域 -->
      <scroll-view 
        scroll-y 
        class="flex-1 px-4" 
        :style="{ paddingTop: ((safeAreaInsets?.top || 0) + 70) + 'px', paddingBottom: '180px' }"
        :scroll-into-view="scrollViewId"
        @scroll="handleScroll"
        :scroll-with-animation="true"
      >
        <!-- AI 聊天消息列表 -->
        <view v-for="message in messages" :key="message.id" :id="`msg-${message.id}`" class="mb-6">
          <!-- 遍历消息段 -->
          <view v-for="(segment, index) in message.content" :key="index" class="mb-2">
            
            <!-- 文本段 -->
            <view v-if="segment.type === 'text'" 
              class="py-3 px-5 rounded-2xl max-w-[85%] text-base leading-relaxed shadow-sm"
              :class="[
                message.type === 'user' 
                  ? 'bg-ts-purple text-white ml-auto rounded-br-sm' 
                  : 'bg-white text-gray-800 mr-auto rounded-bl-sm border border-gray-100'
              ]"
            >
              {{ segment.text }}
              <text v-if="message.isStreaming && index === message.content.length - 1" class="animate-pulse">...</text>
            </view>

            <!-- 菜品卡片 -->
            <view v-else-if="segment.type === 'card_dish'" class="w-full pl-2">
               <DishCard v-for="(dish, i) in segment.data" :key="i" :dish="dish" />
            </view>

            <!-- 规划卡片 -->
            <view v-else-if="segment.type === 'card_plan'" class="w-full pl-2">
               <PlanningCard 
                 v-for="(plan, i) in segment.data" 
                 :key="i" 
                 :plan="plan" 
                 @apply="handleApplyPlan"
                 @discard="handleDiscardPlan"
               />
            </view>

            <!-- 食堂卡片 -->
            <view v-else-if="segment.type === 'card_canteen'" class="w-full pl-2">
               <CanteenCard v-for="(canteen, i) in segment.data" :key="i" :canteen="canteen" />
            </view>

            <!-- 窗口卡片 -->
            <view v-else-if="segment.type === 'card_window'" class="w-full pl-2">
               <WindowCard v-for="(window, i) in segment.data" :key="i" :window="window" />
            </view>

          </view>
        </view>
        
        <!-- 滚动锚点 -->
        <view :id="scrollAnchorId" class="h-px w-full"></view>
      </scroll-view>

      <!-- 底部固定区域 -->
      <view class="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pb-[calc(20px+env(safe-area-inset-bottom))] pt-10 px-4 pointer-events-none">
         <view class="pointer-events-auto relative w-full max-w-screen-md mx-auto">
            <!-- 快捷提示词 -->
            <view class="mb-3">
               <SuggestionChips :suggestions="suggestions" @select="handleSuggestionSelect" />
            </view>

            <!-- 输入框 -->
            <InputBar v-model:scene="scene" @update:scene="setScene" ref="inputBarRef" :loading="aiLoading" @send="handleSend" />
         </view>
      </view>

      <!-- 历史记录抽屉 -->
      <view v-if="showHistory" class="fixed inset-0 z-50">
        <view class="absolute inset-0 bg-black/30" @click="closeHistory"></view>
        <view class="absolute top-0 left-0 h-full w-4/5 max-w-[320px] bg-white shadow-2xl flex flex-col">
          <view class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <text class="text-base font-semibold text-gray-800">历史对话</text>
            <view class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-200" @click="closeHistory">
              <text class="iconify text-gray-500" data-icon="mdi:close" data-width="18"></text>
            </view>
          </view>
          <scroll-view scroll-y class="flex-1">
            <view v-if="!historyEntries.length" class="p-4 text-sm text-gray-400">暂无历史记录</view>
            <view 
              v-for="item in historyEntries" 
              :key="item.sessionId" 
              class="px-4 py-3 border-b border-gray-100 active:bg-gray-50"
              @click="handleLoadHistory(item.sessionId)"
            >
              <view class="flex items-center justify-between">
                <text class="text-sm font-medium text-gray-800 truncate">{{ item.title || '对话' }}</text>
                <view class="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100">
                  <text class="text-[11px] text-purple-700">{{ sceneLabelMap[item.scene] || item.scene }}</text>
                </view>
              </view>
              <text class="text-xs text-gray-400">{{ formatTime(item.updatedAt) }}</text>
            </view>
          </scroll-view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useChat } from './composables/use-chat';
import DishCard from './components/DishCard.vue';
import PlanningCard from './components/PlanningCard.vue';
import CanteenCard from './components/CanteenCard.vue';
import WindowCard from './components/WindowCard.vue';
import InputBar from './components/InputBar.vue';
import SuggestionChips from './components/SuggestionChips.vue';
import { AIChatSkeleton } from '@/components/skeleton';
import type { ComponentMealPlanDraft, AIScene } from '@/types/api';

const { 
  messages, 
  aiLoading, 
  suggestions, 
  isInitialLoading, 
  sendMessage,
  handleSuggestionClick,
  resetChat,
  scene,
  setScene,
  historyEntries,
  loadHistorySession
} = useChat();

const scrollAnchorId = 'chat-bottom-anchor';
const scrollViewId = ref(scrollAnchorId);
const inputBarRef = ref<InstanceType<typeof InputBar> | null>(null);
const systemInfo = uni.getSystemInfoSync();
const safeAreaInsets = systemInfo.safeAreaInsets;
const showHistory = ref(false);

const sceneLabelMap: Record<AIScene, string> = {
  general_chat: '普通对话',
  meal_planner: '餐单规划',
  dish_critic: '菜品点评'
};

const sceneBadge = computed(() => sceneLabelMap[scene.value] || scene.value);

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

const openHistory = () => {
  showHistory.value = true;
};

const closeHistory = () => {
  showHistory.value = false;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const handleLoadHistory = async (sessionId: string) => {
  const ok = await loadHistorySession(sessionId);
  if (ok) {
    closeHistory();
    setTimeout(() => {
      scrollViewId.value = '';
      scrollViewId.value = scrollAnchorId;
    }, 50);
  } else {
    uni.showToast({ title: '加载历史失败', icon: 'none' });
  }
};

const handleNewChat = () => {
  uni.showModal({
    title: '新建对话',
    content: '确定要开始新的对话吗？当前对话记录将被清除。',
    success: (res) => {
        if (res.confirm) {
        resetChat(scene.value);
      }
    }
  });
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