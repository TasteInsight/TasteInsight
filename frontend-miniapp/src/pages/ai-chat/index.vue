<template>
  <view class="flex flex-col h-screen bg-gray-50">
    <!-- 骨架屏 -->
    <AIChatSkeleton v-if="isInitialLoading" />

    <template v-else>
      <!-- 顶部导航栏 -->
      <view 
        class="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100 shadow-sm transition-all duration-300"
      >
         <view class="flex items-center justify-between px-4 h-12">
            <!-- 场景徽标 -->
            <view class="flex items-center">
              <view class="flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 shadow-sm">
                <view class="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2 animate-pulse"></view>
                <text class="text-xs font-semibold text-purple-700 tracking-wide">{{ sceneBadge }}</text>
              </view>
            </view>
            
            <!-- 右侧操作区 -->
            <view class="flex items-center space-x-3">
              <view
                class="group flex items-center justify-center px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 active:bg-gray-100 active:scale-95 transition-all duration-200"
                @click.stop="handleNewChat"
              >
                 <text class="text-xs font-medium text-gray-600 group-active:text-gray-900">新建对话</text>
              </view>
              <view
                class="group flex items-center justify-center px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 active:bg-gray-100 active:scale-95 transition-all duration-200"
                @click.stop="openHistory"
              >
                 <text class="text-xs font-medium text-gray-600 group-active:text-gray-900">历史记录</text>
              </view>
            </view>
         </view>
      </view>
    
      <!-- 聊天区域 -->
      <scroll-view 
        scroll-y 
        class="flex-1" 
        :style="{ paddingTop: contentPaddingTop + 'px', paddingBottom: '160px' }"
        :scroll-into-view="scrollIntoViewId"
        :scroll-with-animation="true"
      >
        <!-- AI 聊天消息列表 -->
        <view v-for="(message, index) in messages" :key="message.id" :id="`msg-${message.id}`" class="mb-6 px-4">
          
          <!-- 消息头部时间 (可选，两条消息间隔久才显示) -->
          <view v-if="shouldShowTime(index, messages)" class="flex justify-center mb-4">
             <text class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{{ formatTimeShort(message.timestamp) }}</text>
          </view>

          <!-- 遍历消息段 -->
          <view v-for="(segment, index) in message.content" :key="index" class="mb-2 w-full flex flex-col" 
             :class="message.type === 'user' ? 'items-end' : 'items-start'">
            
            <!-- 文本段 (增加 markdown-style class) -->
            <view v-if="segment.type === 'text'" 
              class="py-2 px-3 rounded-xl max-w-[80%] text-[15px] shadow-sm relative"
              :class="[
                message.type === 'user' 
                  ? 'bg-purple-600 text-white rounded-br-sm' 
                  : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
              ]"
            >
              <!-- 核心修复：支持换行和空格 -->
              <text :user-select="true" class="whitespace-pre-wrap leading-normal">{{ segment.text }}</text>
              
              <!-- 流式传输的光标动画 -->
              <view v-if="message.isStreaming && index === message.content.length - 1" class="inline-block w-2 h-4 ml-1 bg-current opacity-70 animate-pulse align-middle"></view>
            </view>

            <!-- 菜品卡片 (组件内部负责点击跳转) -->
            <view v-else-if="segment.type === 'card_dish'" class="w-full max-w-[90%] mt-1">
               <!-- 假设 DishCard 支持 horizontal scroll 或者是单个 -->
               <scroll-view scroll-x class="whitespace-nowrap w-full" v-if="segment.data.length > 1">
                 <view class="inline-block mr-2 align-top" v-for="(dish, i) in segment.data" :key="i">
                   <DishCard :dish="dish" />
                 </view>
               </scroll-view>
               <view v-else>
                  <DishCard :dish="segment.data[0]" />
               </view>
            </view>

            <!-- 规划卡片 (绑定应用事件) -->
            <view v-else-if="segment.type === 'card_plan'" class="w-full max-w-[90%] mt-1">
               <PlanningCard 
                 v-for="(plan, i) in segment.data" 
                 :key="i" 
                 :plan="plan" 
                 @apply="handleApplyPlan"
                 @discard="handleDiscardPlan"
               />
            </view>

            <!-- 食堂/窗口卡片 -->
            <view v-else-if="segment.type === 'card_canteen'" class="w-full max-w-[90%] mt-1">
               <CanteenCard v-for="(canteen, i) in segment.data" :key="i" :canteen="canteen" />
            </view>

             <view v-else-if="segment.type === 'card_window'" class="w-full max-w-[90%] mt-1">
               <WindowCard v-for="(window, i) in segment.data" :key="i" :window="window" />
            </view>

          </view>
        </view>
        
        <!-- 底部垫高，防止被输入框遮挡 -->
        <view id="chat-bottom-anchor" :style="{ height: '10px' }"></view>
      </scroll-view>

      <!-- 底部固定区域 -->
      <view class="fixed bottom-0 left-0 right-0 z-40 flex flex-col">
         <!-- 快捷提示词 (Chips) -->
         <view v-if="suggestions.length > 0" class="bg-gray-50 w-full py-2">
            <view class="max-w-screen-md mx-auto">
               <SuggestionChips :suggestions="suggestions" @select="handleSuggestionSelect" />
            </view>
         </view>

         <!-- 输入框区域 -->
         <view class="bg-gray-50 w-full pb-[calc(5px+env(safe-area-inset-bottom))] mb-1 px-4 relative z-50">
            <view class="max-w-screen-md mx-auto">
               <InputBar 
                 v-model:scene="scene" 
                 @update:scene="setScene" 
                 ref="inputBarRef" 
                 :loading="aiLoading" 
                 @send="handleSend" 
               />
            </view>
         </view>
      </view>

      <!-- 历史记录抽屉 (保持不变) -->
      <!-- #ifdef MP-WEIXIN -->
      <page-container 
        :show="showHistory" 
        :overlay="false" 
        :duration="300"
        custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
        @leave="closeHistory" 
      />
      <!-- #endif -->
      <view v-if="showHistory" class="fixed inset-0 z-50 transition-opacity duration-300">
        <view class="absolute inset-0 bg-black/30" @click="closeHistory"></view>
        <view class="absolute top-0 left-0 h-full w-4/5 max-w-[320px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
          <view class="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <text class="text-lg font-bold text-gray-800">历史对话</text>
            <view class="p-2 -mr-2 active:bg-gray-200 rounded-full" @click="closeHistory">
              <!-- Close Icon -->
              <text class="text-xl text-gray-500">×</text>
            </view>
          </view>
          <scroll-view scroll-y class="flex-1">
             <!-- ... 列表内容 ... -->
              <view 
              v-for="item in historyEntries" 
              :key="item.sessionId" 
              class="px-4 py-4 border-b border-gray-50 active:bg-gray-50 transition-colors"
              @click="handleLoadHistory(item.sessionId)"
            >
              <view class="flex items-center justify-between mb-1">
                <text class="text-sm font-semibold text-gray-800 truncate flex-1 mr-2">{{ item.title || '对话' }}</text>
                <view class="px-2 py-0.5 rounded bg-purple-100">
                  <text class="text-[10px] text-purple-700 font-medium">{{ sceneLabelMap[item.scene] || '对话' }}</text>
                </view>
              </view>
              <text class="text-xs text-gray-400">{{ formatTime(item.updatedAt) }}</text>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- 新建对话弹窗 (保持不变) -->
      <!-- #ifdef MP-WEIXIN -->
      <page-container 
        :show="showNewChatModal" 
        :overlay="false" 
        :duration="300"
        custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
        @leave="cancelNewChat" 
      />
      <!-- #endif -->
      <view v-if="showNewChatModal" class="fixed inset-0 z-[100] flex items-center justify-center" @click="cancelNewChat">
        <!-- ... 保持不变 ... -->
         <view class="absolute inset-0 bg-black/40"></view>
        <view class="relative bg-white rounded-2xl mx-6 p-6 w-[300px]" @click.stop>
          <text class="text-lg font-bold text-gray-800 block mb-2">开始新对话</text>
          <text class="text-sm text-gray-500 block mb-6">选择一个场景，让AI更好地为您服务</text>
          
          <picker mode="selector" :range="sceneOptions" range-key="label" :value="selectedSceneIndex" @change="handleScenePicker">
            <view class="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-6 bg-gray-50 active:bg-gray-100">
              <view class="flex items-center">
                <text class="text-sm font-medium text-gray-700">{{ sceneOptions[selectedSceneIndex].label }}</text>
              </view>
              <text class="text-gray-400">▼</text>
            </view>
          </picker>

          <view class="flex gap-3">
            <view class="flex-1 bg-gray-100 active:bg-gray-200 rounded-xl py-3 flex items-center justify-center" @click="cancelNewChat">
              <text class="text-sm font-bold text-gray-600">取消</text>
            </view>
            <view class="flex-1 bg-purple-600 active:bg-purple-700 rounded-xl py-3 flex items-center justify-center shadow-lg shadow-purple-200" @click="confirmNewChat">
              <text class="text-sm font-bold text-white">开始</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';
import { useChat } from './composables/use-chat';
import request from '@/utils/request'; 
import DishCard from './components/DishCard.vue';
import PlanningCard from './components/PlanningCard.vue';
import CanteenCard from './components/CanteenCard.vue';
import WindowCard from './components/WindowCard.vue';
import InputBar from './components/InputBar.vue';
import SuggestionChips from './components/SuggestionChips.vue';
import { AIChatSkeleton } from '@/components/skeleton';
import type { ComponentMealPlanDraft, AIScene } from '@/types/api';

// === Composables ===
const { 
  messages, 
  aiLoading, 
  suggestions, 
  isInitialLoading, 
  sendMessage,
  resetChat,
  scene,
  setScene,
  historyEntries,
  loadHistorySession
} = useChat();

// 调试：监听suggestions变化
watch(suggestions, (newSuggestions) => {
  console.log('[AI Chat Page] suggestions changed:', newSuggestions);
}, { immediate: true });

// === State ===
const scrollIntoViewId = ref(''); // 用于滚动到指定元素
const inputBarRef = ref<InstanceType<typeof InputBar> | null>(null);
let scrollTimeout: any = null; // 用于防抖滚动
const systemInfo = uni.getSystemInfoSync();
const safeAreaInsets = systemInfo.safeAreaInsets;
const NAV_HEIGHT = 48; // header content height (h-12 = 48px)
const EXTRA_TOP_PADDING = 8; // additional spacing between header and chat content (px)

if(process.env.NODE_ENV === 'development'){
  console.debug('[AI Chat] safeAreaInsets.top', safeAreaInsets?.top);
}

const contentPaddingTop = computed(() => NAV_HEIGHT + EXTRA_TOP_PADDING);
const showHistory = ref(false);
const showNewChatModal = ref(false);
const sceneOptions = [
  { value: 'general_chat', label: '随便聊聊' },
  { value: 'meal_planner', label: '餐单规划' },
  { value: 'dish_critic', label: '菜品点评' }
];
const selectedScene = ref<AIScene>('general_chat');
const selectedSceneIndex = ref(0);

// === Computed ===
const sceneLabelMap: Record<string, string> = {
  general_chat: '随便聊聊',
  meal_planner: '餐单规划',
  dish_critic: '菜品点评'
};
const sceneBadge = computed(() => sceneLabelMap[scene.value] || '对话');

// === Scroll Logic (Critical for Streaming) ===
const scrollToBottom = () => {
  nextTick(() => {
    // 使用 scroll-into-view 滚动到底部锚点
    // 先清空再设置，确保每次都能触发
    scrollIntoViewId.value = '';
    setTimeout(() => {
      scrollIntoViewId.value = 'chat-bottom-anchor';
    }, 10);
  });
};

// 监听消息数量变化 (新消息)
watch(() => messages.value.length, () => {
  // 消息增加时，立即滚动到底部
  scrollToBottom();
  // 再次延迟滚动，确保渲染完成后（特别是图片或卡片加载后）能到底部
  setTimeout(scrollToBottom, 150);
  setTimeout(scrollToBottom, 300);
});

// 监听流式传输内容变化 (文本逐字出现)
watch(() => {
  const lastMsg = messages.value[messages.value.length - 1];
  if (lastMsg && lastMsg.isStreaming) {
    // 监听最后一个 segment 的文本长度
    const segments = lastMsg.content;
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg.type === 'text') {
      return lastSeg.text.length;
    }
    // 或者监听 segments 数量变化
    return segments.length;
  }
  return 0;
}, () => {
  // 防抖滚动：延迟 100ms 执行，避免频繁滚动
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    scrollToBottom();
  }, 100);
});


// === Handlers ===

const handleSend = (text: string) => {
  sendMessage(text);
};

// 点击提示词，直接发送，体验更好
const handleSuggestionSelect = (text: string) => {
  sendMessage(text);
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

// 历史记录相关
const openHistory = () => { showHistory.value = true; };
const closeHistory = () => { showHistory.value = false; };
const handleLoadHistory = async (sessionId: string) => {
  const ok = await loadHistorySession(sessionId);
  if (ok) {
    closeHistory();
    scrollToBottom();
  } else {
    uni.showToast({ title: '加载历史失败', icon: 'none' });
  }
};
const handleScenePicker = (e: any) => {
  const idx = e.detail.value;
  if (typeof idx === 'number' && idx >= 0 && idx < sceneOptions.length) {
    selectedSceneIndex.value = idx;
    selectedScene.value = sceneOptions[idx].value as AIScene;
  } else {
    uni.showToast({ title: '无效的选项', icon: 'none' });
  }
};

// === 核心业务逻辑：应用规划 ===
const handleApplyPlan = async (plan: ComponentMealPlanDraft & { appliedStatus?: 'success' | 'failed' }) => {
  const action = plan.confirmAction;
  
  if (!action || !action.api) {
    uni.showToast({ title: '无效的规划数据', icon: 'none' });
    return;
  }

  uni.showLoading({ title: '正在保存...' });

  try {
    // 1. 调用业务接口保存规划
    const res = await request({
      url: action.api,
      method: action.method as any || 'POST',
      data: action.body
    });

    uni.hideLoading();

    if (res.code === 200) {
      uni.showToast({ title: '已应用到日程', icon: 'success' });
      // 更新 UI 状态
      plan.appliedStatus = 'success';

      // 2. 【闭环】自动告诉 AI "我已应用"
      setTimeout(() => {
        sendMessage("我已确认应用了该饮食规划，请帮我生成后续建议");
      }, 500);
    } else {
      // 业务逻辑失败
      uni.showToast({ title: res.message || '保存失败，请重试', icon: 'none' });
      // 更新 UI 状态
      plan.appliedStatus = 'failed';
    }

  } catch (error) {
    uni.hideLoading();
    uni.showToast({ title: '保存失败，请重试', icon: 'none' });
    console.error(error);
    // 更新 UI 状态
    plan.appliedStatus = 'failed';
  }
};

const handleDiscardPlan = () => {
  uni.showToast({ title: '已取消', icon: 'none' });
};

// Helpers
const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};
const formatTimeShort = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
     return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const shouldShowTime = (index: number, messages: any[]) => {
  // 显示时间戳：如果是第一条，或者跟上一条间隔超过5分钟
  if (index === 0) return true;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (!prev || !curr) return true;
  return (curr.timestamp - prev.timestamp) > 5 * 60 * 1000;
};
</script>

<style scoped>
/* 保留换行符 */
.whitespace-pre-wrap {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>