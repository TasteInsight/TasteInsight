<template>
  <view class="flex flex-col h-screen bg-gray-50">
    <!-- 骨架屏：首次加载时显示 -->
    <AIChatSkeleton v-if="isInitialLoading" />

    <template v-else>
      <!-- 顶部导航栏 -->
      <view 
        class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-3 py-2 flex justify-between items-center shadow-sm"
        :style="{ paddingTop: (safeAreaInsets?.top || 0) + 'px' }"
      >
         <view class="flex-1 flex items-center justify-between">
            <view class="flex items-center">
              <view class="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-100">
                <text class="text-xs font-medium text-purple-700">{{ sceneBadge }}</text>
              </view>
            </view>
            <view class="flex items-center justify-center flex-1">
              <view class="flex items-center space-x-2">
                <!-- 新建对话 -->
                <view
                  class="flex flex-col items-center justify-center bg-gray-100 active:bg-gray-200 px-3 py-1.5 rounded-full"
                  @click.stop="handleNewChat"
                >
                   <text class="text-xs font-medium text-gray-700 mt-0.5">新建对话</text>
                </view>

                <!-- 历史记录 -->
                <view
                  class="flex flex-col items-center justify-center bg-gray-100 active:bg-gray-200 px-3 py-1.5 rounded-full"
                  @click.stop="openHistory"
                >
                   <text class="text-xs font-medium text-gray-700 mt-0.5">历史记录</text>
                </view>
              </view>
            </view>
            <view class="flex items-center">
              <view class="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                <text class="iconify text-gray-500" data-icon="mdi:dots-vertical" data-width="16"></text>
              </view>
            </view>
         </view>
      </view>
    
      <!-- 聊天区域 -->
      <scroll-view 
        scroll-y 
        class="flex-1 px-4" 
        :style="{ paddingTop: ((safeAreaInsets?.top || 0) + 56) + 'px', paddingBottom: '180px' }"
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

      <!-- 新建对话弹窗 -->
      <view v-if="showNewChatModal" class="fixed inset-0 z-[100] flex items-center justify-center" @click="cancelNewChat">
        <view class="absolute inset-0 bg-black/40"></view>
        <view class="relative bg-white rounded-2xl mx-6 p-6 w-[300px]" @click.stop>
          <text class="text-lg font-semibold text-gray-800 block mb-4">新建对话</text>
          <text class="text-sm text-gray-600 block mb-4">请选择对话场景</text>
          
          <picker mode="selector" :range="sceneOptions" range-key="label" :value="selectedSceneIndex" @change="handleScenePicker">
            <view class="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 mb-6 bg-gray-50 active:bg-gray-100">
              <view class="flex items-center">
                <text class="iconify text-ts-purple mr-2" data-icon="mdi:tag-outline" data-width="20"></text>
                <text class="text-sm text-gray-700">{{ sceneOptions[selectedSceneIndex].label }}</text>
              </view>
              <text class="iconify text-gray-400" data-icon="mdi:chevron-down" data-width="18"></text>
            </view>
          </picker>

          <view class="flex gap-3">
            <view class="flex-1 bg-gray-100 active:bg-gray-200 rounded-lg py-2.5 flex items-center justify-center" @click="cancelNewChat">
              <text class="text-sm font-medium text-gray-700">取消</text>
            </view>
            <view class="flex-1 bg-ts-purple active:bg-purple-600 rounded-lg py-2.5 flex items-center justify-center" @click="confirmNewChat">
              <text class="text-sm font-medium text-white">确定</text>
            </view>
          </view>
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
const showNewChatModal = ref(false);
const sceneOptions = [
  { value: 'general_chat', label: '普通对话' },
  { value: 'meal_planner', label: '餐单规划' },
  { value: 'dish_critic', label: '菜品点评' }
];
const selectedScene = ref<AIScene>('general_chat');
const selectedSceneIndex = ref(0);

const sceneLabelMap: Record<AIScene, string> = {
  general_chat: '普通对话',
  meal_planner: '餐单规划',
  dish_critic: '菜品点评'
};

const handleScenePicker = (e: any) => {
  const idx = e.detail.value;
  selectedSceneIndex.value = idx;
  selectedScene.value = sceneOptions[idx].value as AIScene;
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
  showNewChatModal.value = true;
};

const confirmNewChat = () => {
  resetChat(selectedScene.value);
  showNewChatModal.value = false;
};

const cancelNewChat = () => {
  showNewChatModal.value = false;
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