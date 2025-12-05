<template>
  <view class="app-page ai-chat-page">
    <!-- 骨架屏：首次加载时显示 -->
    <AIChatSkeleton v-if="isInitialLoading" />

    <template v-else>
    <view class="page-header">
        <text class="header-title">问AI</text>
        <view class="history-btn" @click="alertHistory">
          <text class="iconify" data-icon="mdi:history" data-width="16"></text>
          历史记录
        </view>
    </view>
    
    <scroll-view 
      scroll-y 
      class="content-container" 
      :scroll-into-view="scrollViewId"
      :style="{ paddingBottom: '110px' }" 
      @scroll="handleScroll"
    >
      <!-- AI 聊天消息列表 -->
      <view v-for="message in chatStore.messages" :key="message.id" :id="`msg-${message.id}`">
        <!-- 基础文本气泡 -->
        <view class="chat-bubble" :class="[message.type === 'user' ? 'chat-right' : 'chat-left']">
          {{ message.text }}
          <text v-if="message" class="loading-dots">...</text>
        </view>

        <!-- AI推荐卡片 (仅在 AI 消息且有推荐内容时展示) -->
        <view v-if="message.recommendations && message.recommendations.length > 0">
          <RecommendationCard 
            v-for="rec in message.recommendations" 
            :key="rec.dish.id" 
            :recommendation="rec" 
          />
        </view>
      </view>
      
      <!-- 滚动锚点 -->
      <view :id="scrollAnchorId" style="height: 1px;"></view>
    </scroll-view>

    <!-- 底部输入框 (绝对定位在底部，覆盖内容) -->
    <InputBar class="fixed-input-bar" />
    </template>

    <!-- 底部导航 (由pages.json处理，此处不重复实现) -->
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import RecommendationCard from './components/RecommendationCard.vue';
import InputBar from './components/InputBar.vue';
import { AIChatSkeleton } from '@/components/skeleton';

const chatStore = useChatStore();
const scrollAnchorId = 'chat-bottom-anchor';
const scrollViewId = ref(scrollAnchorId);

// 首次加载状态
const hasInitialized = ref(false);
const isInitialLoading = computed(() => !hasInitialized.value && chatStore.messages.length === 0);

// 监听消息变化，自动滚动到底部
watch(() => chatStore.messages.length, () => {
  // 使用 nextTick/setTimeout 确保 DOM/Scroll-view 更新完成后再滚动
  setTimeout(() => {
    scrollViewId.value = ''; // 强制更新滚动
    scrollViewId.value = scrollAnchorId;
  }, 50); 
}, { deep: true });

onMounted(() => {
    if (chatStore.messages.length === 0) {
        chatStore.startNewSession(); // 初始化欢迎消息
    }
    hasInitialized.value = true;
});

const alertHistory = () => {
  uni.showToast({ title: '查看历史记录 (功能待实现)', icon: 'none' });
  // 实际应导航到历史记录页面
  // uni.navigateTo({ url: '/pages/ai-chat/history' });
};

// 避免滚动时频繁触发 watch
const handleScroll = (e : Event) => {
    // 可以添加逻辑，例如在用户向上滚动时停止自动滚动
};
</script>

<style scoped lang="scss">


.ai-chat-page {
  /* 确保页面是全屏的 flex 容器 */
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative; 
  background-color: #f5f5f5; 
}

/* 模拟 prototype 头部和历史记录按钮 */
.page-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background: white;
  border-bottom: 1px solid #eee;
  position: relative;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.history-btn {
  /* 模拟 prototype .history-btn 样式 */
  position: absolute;
  top: 10px;
  right: 16px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  
  .iconify {
      margin-right: 4px;
  }
}

.content-container {
  /* 填充剩余空间，并允许滚动 */
  flex: 1;
  padding: 16px;
  /* 底部预留空间给 InputBar */
  padding-bottom: 110px; 
}

/* 聊天气泡样式 */
.chat-bubble {
  padding: 10px 16px;
  border-radius: 18px;
  max-width: 80%; /* 限制宽度 */
  margin-bottom: 16px;
  font-size: 15px;
}

.chat-left {
  background: #f1f1f1;
  border-bottom-left-radius: 4px;
  margin-right: auto;
  margin-left: 0;
}

.chat-right {
  background: #82318E; /* purple-bg */
  color: white;
  border-bottom-right-radius: 4px;
  margin-left: auto;
  margin-right: 0;
}

.loading-dots {
    animation: blinker 1s linear infinite;
}

@keyframes blinker {
  50% {
    opacity: 0.5;
  }
}
</style>