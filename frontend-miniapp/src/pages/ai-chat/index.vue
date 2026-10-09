<template>
  <view class="ai-chat-page">
    <view
      class="ai-chat-toolbar page-navigation-bar"
      :class="{ 'ai-chat-toolbar-native': hasNativeTitle }"
    >
      <button
        class="chat-button chat-toolbar-new"
        hover-class="chat-control-pressed"
        :hover-stay-time="80"
        role="button"
        tabindex="0"
        aria-label="新对话"
        @click="handleNewChat"
        @keydown="handleActionKeydown"
        @keyup="handleActionKeyup($event, handleNewChat)"
        @blur="keyPressed = false"
      >
        <image class="chat-tool-icon" src="/static/icons/chat-new.png" aria-hidden="true" />
        <text>新对话</text>
      </button>
      <text v-if="!hasNativeTitle" class="ai-chat-title page-navigation-title">AI 助手</text>
      <button
        class="chat-button chat-toolbar-history"
        hover-class="chat-control-pressed"
        :hover-stay-time="80"
        role="button"
        tabindex="0"
        aria-label="历史对话"
        @click="openHistory"
        @keydown="handleActionKeydown"
        @keyup="handleActionKeyup($event, openHistory)"
        @blur="keyPressed = false"
      >
        <image class="chat-tool-icon" src="/static/icons/history.png" aria-hidden="true" />
        <text>历史</text>
      </button>
    </view>
    <scroll-view
      ref="messageScroller"
      scroll-y
      class="ai-chat-messages"
      :scroll-into-view="scrollIntoViewId"
      :scroll-with-animation="false"
      @scroll="handleScroll"
      @scrolltolower="handleScrollToLower"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @keydown="handleReadingKeydown"
    >
      <view class="ai-chat-transcript">
        <view v-if="initialError" class="chat-state" role="status">
          <text class="chat-state-title">连接暂时不可用</text
          ><text class="chat-state-description">{{ initialError }}</text>
          <button
            class="chat-button chat-button-primary"
            hover-class="chat-control-pressed"
            :hover-stay-time="80"
            role="button"
            tabindex="0"
            @click="retryConnection"
            @keydown="handleActionKeydown"
            @keyup="handleActionKeyup($event, retryConnection)"
            @blur="keyPressed = false"
          >
            重试连接
          </button>
        </view>
        <view v-else-if="!isInitialLoading && messages.length === 0" class="chat-state">
          <text class="chat-state-title">今天想吃什么？</text
          ><text class="chat-state-description">告诉我你的口味，或选择下方的问题开始。</text>
        </view>
        <template v-else>
          <view
            v-for="message in messages"
            :key="message.id"
            :id="`msg-${message.id}`"
            class="chat-message"
          >
            <template v-for="(segment, segmentIndex) in message.content" :key="segmentIndex">
              <view
                v-if="segment.type === 'text' ? segment.text.trim() : segment.data.length"
                class="chat-segment"
                :class="{
                  'chat-segment-user': message.type === 'user',
                  'chat-segment-text': segment.type === 'text',
                  'chat-segment-card': segment.type !== 'text',
                }"
              >
                <view
                  v-if="segment.type === 'text'"
                  class="chat-bubble"
                  :class="message.type === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'"
                >
                  <MarkdownText v-if="message.type === 'ai'" :content="segment.text" />
                  <text v-else :user-select="true" class="chat-user-text">{{ segment.text }}</text>
                </view>
                <view
                  v-else-if="segment.type === 'card_dish'"
                  class="chat-card-stack chat-card-stack-dishes"
                  role="group"
                  aria-label="推荐菜品"
                >
                  <template v-for="(dish, dishIndex) in segment.data" :key="dishIndex">
                    <view v-if="dish?.dish" class="chat-dish-row"><DishCard :dish="dish" /></view>
                  </template>
                </view>
                <view
                  v-else-if="segment.type === 'card_preferences'"
                  class="chat-card-stack chat-card-stack-preferences"
                >
                  <PreferenceCard
                    v-for="(preference, preferenceIndex) in segment.data"
                    :key="`${currentSessionId}:${message.id}:${segmentIndex}:${preferenceIndex}`"
                    :draft="preference"
                    @save="applyPreferences"
                    @dismiss="dismissPreferences"
                  />
                </view>
                <view
                  v-else-if="segment.type === 'card_plan'"
                  class="chat-card-stack chat-card-stack-plans"
                >
                  <PlanningCard
                    v-for="(plan, planIndex) in segment.data"
                    :key="`${currentSessionId}:${message.id}:${segmentIndex}:${planIndex}`"
                    :plan="plan"
                    @apply="handleApplyPlan"
                  />
                </view>
                <view v-else-if="segment.type === 'card_canteen'" class="chat-card-stack"
                  ><CanteenCard v-for="(canteen, i) in segment.data" :key="i" :canteen="canteen"
                /></view>
                <view v-else-if="segment.type === 'card_window'" class="chat-card-stack"
                  ><WindowCard v-for="(window, i) in segment.data" :key="i" :window="window"
                /></view>
              </view>
            </template>
            <view v-if="message.type === 'user'" class="chat-message-meta">
              <text class="chat-timestamp">{{ formatTimeShort(message.timestamp) }}</text>
              <view
                v-if="deliveryFor(message)"
                class="chat-delivery-status"
                role="status"
                :aria-label="deliveryFor(message)!.label"
              >
                <image
                  v-if="deliveryFor(message)!.icon"
                  class="chat-delivery-icon"
                  :src="deliveryFor(message)!.icon"
                  aria-hidden="true"
                />
                <text v-if="deliveryFor(message)!.text">{{ deliveryFor(message)!.text }}</text>
              </view>
            </view>
          </view>
          <text v-if="aiLoading" class="chat-reply-status" role="status">正在回复…</text>
        </template>
        <view id="chat-bottom-anchor" class="chat-bottom-anchor" />
      </view>
    </scroll-view>
    <view class="ai-chat-footer">
      <button
        class="chat-button chat-latest"
        hover-class="chat-control-pressed"
        :hover-stay-time="80"
        :class="{ 'chat-latest-visible': !followingLatest }"
        role="button"
        aria-label="回到最新"
        :aria-hidden="followingLatest"
        :tabindex="followingLatest ? -1 : 0"
        :disabled="followingLatest"
        @click="returnToLatest"
        @keydown="handleActionKeydown"
        @keyup="handleActionKeyup($event, returnToLatest)"
        @blur="keyPressed = false"
      >
        <image class="chat-latest-icon" src="/static/icons/chevron-down.png" aria-hidden="true" />
      </button>
      <SuggestionChips
        v-if="suggestions.length && !aiLoading && !composerFocused"
        :suggestions="suggestions"
        :disabled="sending || isInitializing"
        @select="handleSuggestionSelect"
      />
      <InputBar
        v-model="draft"
        :loading="aiLoading"
        :busy="sending || isInitializing"
        @send="handleSend"
        @stop="handleStopStreaming"
        @focus="composerFocused = true"
        @blur="composerFocused = false"
      />
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <page-container
      :show="showHistory"
      :overlay="false"
      :duration="0"
      custom-style="position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;"
      @leave="closeHistory"
    />
    <page-container
      :show="showNewChatModal"
      :overlay="false"
      :duration="0"
      custom-style="position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;"
      @leave="cancelNewChat"
    />
    <!-- #endif -->
    <view v-if="showHistory" class="chat-overlay chat-history-overlay" @click="closeHistory">
      <view class="chat-history" role="dialog" aria-label="历史对话" @click.stop>
        <view class="chat-dialog-header"
          ><text class="chat-dialog-title">历史对话</text
          ><button
            class="chat-button"
            hover-class="chat-control-pressed"
            :hover-stay-time="80"
            role="button"
            tabindex="0"
            aria-label="关闭历史对话"
            @click="closeHistory"
            @keydown="handleActionKeydown"
            @keyup="handleActionKeyup($event, closeHistory)"
            @blur="keyPressed = false"
          >
            <view class="chat-close-icon" aria-hidden="true" /></button
        ></view>
        <scroll-view scroll-y class="chat-history-list">
          <text v-if="!historyEntries.length" class="chat-history-empty">暂无历史对话</text>
          <view
            v-for="item in historyEntries"
            :key="item.sessionId"
            class="chat-history-row"
            :class="{ 'chat-history-current': item.sessionId === currentSessionId }"
          >
            <button
              class="chat-history-open"
              hover-class="chat-control-pressed"
              :hover-stay-time="80"
              role="button"
              tabindex="0"
              :aria-current="item.sessionId === currentSessionId ? 'true' : undefined"
              :aria-label="`打开对话：${item.title || '对话'}`"
              @click="handleLoadHistory(item.sessionId)"
              @keydown="handleActionKeydown"
              @keyup="handleActionKeyup($event, () => handleLoadHistory(item.sessionId))"
              @blur="keyPressed = false"
            >
              <view class="chat-history-heading">
                <text class="chat-history-title">{{ item.title || '对话' }}</text>
                <text v-if="item.sessionId === currentSessionId" class="chat-history-current-label"
                  >当前</text
                >
              </view>
              <text class="chat-history-meta"
                >{{ sceneLabelMap[item.scene] || '对话' }} · {{ formatTime(item.updatedAt) }}</text
              >
            </button>
            <button
              class="chat-button chat-history-delete"
              hover-class="chat-control-pressed"
              :hover-stay-time="80"
              role="button"
              tabindex="0"
              :aria-label="`删除对话：${item.title || '对话'}`"
              @click.stop="handleDeleteHistory(item.sessionId)"
              @keydown="handleActionKeydown"
              @keyup="handleActionKeyup($event, () => handleDeleteHistory(item.sessionId))"
              @blur="keyPressed = false"
            >
              <view class="chat-delete-icon" aria-hidden="true" />
            </button>
          </view>
        </scroll-view>
      </view>
    </view>
    <view v-if="showNewChatModal" class="chat-overlay chat-modal-overlay" @click="cancelNewChat">
      <view class="chat-dialog" role="dialog" aria-label="开始新对话" @click.stop>
        <text class="chat-dialog-title">新对话</text
        ><text class="chat-state-description">选择对话主题</text>
        <view class="chat-scenes" role="group" aria-label="对话主题"
          ><button
            v-for="option in sceneOptions"
            :key="option.value"
            class="chat-scene-option"
            hover-class="chat-control-pressed"
            :hover-stay-time="80"
            role="button"
            tabindex="0"
            :aria-pressed="selectedScene === option.value"
            :class="{ 'chat-scene-selected': selectedScene === option.value }"
            @click="selectedScene = option.value"
            @keydown="handleActionKeydown"
            @keyup="handleActionKeyup($event, () => (selectedScene = option.value))"
            @blur="keyPressed = false"
          >
            <text>{{ option.label }}</text>
            <view class="chat-scene-indicator" aria-hidden="true">
              <view v-if="selectedScene === option.value" class="chat-scene-check" />
            </view></button
        ></view>
        <view class="chat-dialog-actions"
          ><button
            class="chat-button"
            hover-class="chat-control-pressed"
            :hover-stay-time="80"
            role="button"
            tabindex="0"
            @click="cancelNewChat"
            @keydown="handleActionKeydown"
            @keyup="handleActionKeyup($event, cancelNewChat)"
            @blur="keyPressed = false"
          >
            取消</button
          ><button
            class="chat-button chat-button-primary"
            hover-class="chat-control-pressed"
            :hover-stay-time="80"
            role="button"
            tabindex="0"
            @click="confirmNewChat"
            @keydown="handleActionKeydown"
            @keyup="handleActionKeyup($event, confirmNewChat)"
            @blur="keyPressed = false"
          >
            开始对话
          </button></view
        >
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onScopeDispose } from 'vue';
import { useChat } from './composables/use-chat';
import DishCard from './components/DishCard.vue';
import MarkdownText from './components/MarkdownText.vue';
import PlanningCard from './components/PlanningCard.vue';
import PreferenceCard from './components/PreferenceCard.vue';
import CanteenCard from './components/CanteenCard.vue';
import WindowCard from './components/WindowCard.vue';
import InputBar from './components/InputBar.vue';
import SuggestionChips from './components/SuggestionChips.vue';
import type { ComponentMealPlanDraft, AIScene } from '@/types/api';
const {
  messages,
  aiLoading,
  currentSessionId,
  suggestions,
  isInitialLoading,
  isInitializing,
  initialError,
  init,
  sendMessage,
  captureOperation,
  resetChat,
  scene,
  historyEntries,
  loadHistorySession,
  applyMealPlan,
  applyPreferences,
  dismissPreferences,
  deleteSession,
  stopStreaming,
} = useChat();
const draft = ref('');
const composerFocused = ref(false);
const sending = ref(false);
const scrollIntoViewId = ref('');
const messageScroller = ref<{ $el?: HTMLElement } | null>(null);
const followingLatest = ref(true);
const showHistory = ref(false);
const showNewChatModal = ref(false);
const selectedScene = ref<AIScene>('general_chat');
const sceneOptions: { value: AIScene; label: string }[] = [
  { value: 'general_chat', label: '聊聊吃什么' },
  { value: 'dish_critic', label: '菜品点评' },
  { value: 'meal_planner', label: '餐单规划' },
];
const sceneLabelMap: Record<string, string> = {
  general_chat: '聊聊吃什么',
  dish_critic: '菜品点评',
  meal_planner: '餐单规划',
};
let hasNativeTitle = false;
// #ifdef MP-WEIXIN
hasNativeTitle = true;
// #endif
const keyPressed = ref(false);
const handleActionKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    keyPressed.value = true;
  }
};
const handleActionKeyup = (event: KeyboardEvent, action: () => unknown) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (keyPressed.value) {
    keyPressed.value = false;
    action();
  }
};
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
const scrollToBottom = () => {
  if (!followingLatest.value) return;
  nextTick(() => {
    if (!followingLatest.value) return;
    scrollIntoViewId.value = '';
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (followingLatest.value) scrollIntoViewId.value = 'chat-bottom-anchor';
    }, 10);
  });
};
const returnToLatest = () => {
  followingLatest.value = true;
  scrollToBottom();
};
let latestScrollTop = 0;
let touchY = 0;
const handleScroll = (event: any) => {
  latestScrollTop = event.detail.scrollTop;
};
const pauseFollowing = () => {
  if (latestScrollTop <= 0) return;
  followingLatest.value = false;
  scrollIntoViewId.value = '';
  if (scrollTimer) clearTimeout(scrollTimer);
};
const handleWheel = (event: WheelEvent) => {
  if (event.deltaY < 0) pauseFollowing();
};
// #ifdef H5
let scrollElement: HTMLElement | undefined;
const handleScrollbarPointer = (event: MouseEvent) => {
  if (event.button === 0 && (event.target as HTMLElement).scrollTop > 0) pauseFollowing();
};
onMounted(() => {
  scrollElement = messageScroller.value?.$el;
  scrollElement?.addEventListener('wheel', handleWheel, { passive: true });
  scrollElement?.addEventListener('mousedown', handleScrollbarPointer);
});
onScopeDispose(() => {
  scrollElement?.removeEventListener('wheel', handleWheel);
  scrollElement?.removeEventListener('mousedown', handleScrollbarPointer);
});
// #endif
const handleTouchStart = (event: any) => {
  touchY = event.touches[0].clientY;
};
const handleTouchMove = (event: any) => {
  const nextY = event.touches[0].clientY;
  if (nextY > touchY) pauseFollowing();
  touchY = nextY;
};
const handleReadingKeydown = (event: KeyboardEvent) => {
  if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) pauseFollowing();
};
const handleScrollToLower = () => {
  followingLatest.value = true;
};
watch(() => messages.value, scrollToBottom, { deep: true });
watch(composerFocused, scrollToBottom);
watch(currentSessionId, () => {
  latestScrollTop = 0;
  sending.value = false;
  followingLatest.value = true;
  scrollToBottom();
});
const handleSend = async (text: string) => {
  if (sending.value || isInitializing.value || aiLoading.value || !text.trim()) return;
  const snapshot = draft.value;
  const conversationId = currentSessionId.value;
  sending.value = true;
  const pending = sendMessage(text);
  const ownsOperation = captureOperation();
  try {
    const accepted = await pending;
    if (!ownsOperation() || (conversationId && currentSessionId.value !== conversationId)) return;
    if (accepted) {
      if (draft.value === snapshot) draft.value = '';
      returnToLatest();
    } else uni.showToast({ title: '消息未发送，请重试', icon: 'none' });
  } finally {
    if (ownsOperation()) sending.value = false;
  }
};
const handleSuggestionSelect = (text: string) => {
  draft.value = text;
  void handleSend(text);
};
const handleStopStreaming = () => stopStreaming();
const retryConnection = () => init();
const handleNewChat = () => {
  selectedScene.value = scene.value;
  showNewChatModal.value = true;
};
const confirmNewChat = () => {
  void resetChat(selectedScene.value);
  showNewChatModal.value = false;
};
const cancelNewChat = () => {
  showNewChatModal.value = false;
};
const openHistory = () => {
  showHistory.value = true;
};
const closeHistory = () => {
  showHistory.value = false;
};
const handleLoadHistory = (sessionId: string) =>
  loadHistorySession(sessionId, loaded => {
    if (loaded) {
      closeHistory();
      returnToLatest();
    } else uni.showToast({ title: '加载历史失败', icon: 'none' });
  });
const handleDeleteHistory = (sessionId: string) => {
  const item = historyEntries.value.find(entry => entry.sessionId === sessionId);
  const ownsOperation = captureOperation();
  return new Promise<boolean | undefined>(resolve =>
    uni.showModal({
      title: '删除对话',
      content: `确定删除“${item?.title || '对话'}”吗？`,
      confirmText: '删除',
      confirmColor: '#660874',
      success: async result => {
        if (!result.confirm || !ownsOperation()) {
          resolve(false);
          return;
        }
        const wasCurrent = sessionId === currentSessionId.value;
        resolve(
          await deleteSession(sessionId, () => {
            if (wasCurrent) {
              closeHistory();
              returnToLatest();
            }
          })
        );
      },
      fail: () => resolve(false),
    })
  );
};
const applyFeedbackOwner = ref<(() => boolean) | null>(null);
let planFollowUpTimer: ReturnType<typeof setTimeout> | null = null;
const cancelPlanFollowUp = () => {
  if (planFollowUpTimer === null) return;
  clearTimeout(planFollowUpTimer);
  planFollowUpTimer = null;
};
const releaseApplyLoading = () => {
  if (!applyFeedbackOwner.value) return;
  applyFeedbackOwner.value = null;
  uni.hideLoading();
};
watch(
  () => applyFeedbackOwner.value?.(),
  isCurrent => {
    if (isCurrent === false) releaseApplyLoading();
  },
  { flush: 'sync' }
);
onScopeDispose(() => {
  releaseApplyLoading();
  cancelPlanFollowUp();
  if (scrollTimer) clearTimeout(scrollTimer);
});
const handleApplyPlan = async (
  plan: ComponentMealPlanDraft & { appliedStatus?: 'success' | 'failed' }
) => {
  const ownsOperation = captureOperation();
  const conversationId = currentSessionId.value;
  const isCurrent = () => ownsOperation() && currentSessionId.value === conversationId;
  if (!isCurrent() || applyFeedbackOwner.value || plan.appliedStatus === 'success') return;
  cancelPlanFollowUp();
  applyFeedbackOwner.value = isCurrent;
  uni.showLoading({ title: '正在加入规划…' });
  try {
    const applied = await applyMealPlan(plan);
    if (!isCurrent()) return;
    releaseApplyLoading();
    if (!applied) return;
    uni.showToast({ title: '已加入我的规划', icon: 'success' });
    planFollowUpTimer = setTimeout(() => {
      planFollowUpTimer = null;
      if (isCurrent()) void sendMessage('我已确认应用了该饮食规划，请帮我生成后续建议');
    }, 500);
  } catch (error) {
    if (!isCurrent()) return;
    releaseApplyLoading();
    uni.showToast({ title: '加入失败，请重试', icon: 'none' });
    console.error(error);
  }
};
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};
const formatTimeShort = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toDateString() === new Date().toDateString()
    ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    : `${date.getMonth() + 1}/${date.getDate()}`;
};
const deliveryStates: Record<string, { label: string; icon?: string; text?: string }> = {
  sending: { label: '发送中', icon: '/static/icons/history.png' },
  received: { label: '服务端已接收', icon: '/static/icons/check-double.png' },
  failed: {
    label: '发送异常，接收未确认',
    icon: '/static/icons/alert.png',
    text: '发送异常，接收未确认',
  },
  unconfirmed: { label: '接收未确认', text: '接收未确认' },
};
const deliveryFor = (message: { type: string; deliveryStatus?: string }) =>
  message.type === 'user' && message.deliveryStatus
    ? deliveryStates[message.deliveryStatus]
    : undefined;
</script>
<style scoped>
.ai-chat-page {
  --chat-accent: #660874;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  height: calc(100vh - var(--window-top, 0px) - var(--window-bottom, 0px));
  height: calc(100dvh - var(--window-top, 0px) - var(--window-bottom, 0px));
  box-sizing: border-box;
  overflow: hidden;
  background: #fff;
  color: #1f2937;
  font-family: system-ui, sans-serif;
}
.ai-chat-toolbar {
  --navigation-inset-top: max(var(--status-bar-height, 0px), env(safe-area-inset-top, 0px));
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  height: calc(var(--page-navigation-height) + var(--navigation-inset-top));
  box-sizing: border-box;
  padding: var(--navigation-inset-top) 20px 0;
  background: #fff;
}
.ai-chat-toolbar-native {
  grid-template-columns: 1fr 1fr;
  height: auto;
  padding: 6px 20px 12px;
}
.chat-tool-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.ai-chat-toolbar .chat-toolbar-new,
.ai-chat-toolbar .chat-toolbar-history {
  gap: 6px;
  padding: 0 8px;
  color: #1f2937;
}
.chat-toolbar-new {
  justify-self: start;
}
.chat-toolbar-history {
  justify-self: end;
}
.chat-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 12px;
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #660874;
  font-size: 14px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    color 140ms ease-out;
}
.chat-button::after,
.chat-history-open::after,
.chat-scene-option::after {
  border: none;
}
.chat-button:focus-visible,
.chat-history-open:focus-visible,
.chat-scene-option:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.chat-button-primary {
  background: #660874;
  color: #fff;
}
.chat-button.chat-control-pressed:not([disabled]) {
  background: #f4f4f5;
}
.chat-button-primary.chat-control-pressed:not([disabled]) {
  background: #50065b;
  color: #fff;
}
@media (prefers-reduced-motion: reduce) {
  .chat-button {
    transition: none;
  }
}
.ai-chat-messages {
  flex: 1;
  min-height: 0;
  height: 0;
  width: 100%;
  overflow: hidden;
}
.ai-chat-transcript {
  padding: 24px 20px 8px;
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
.chat-message {
  margin-bottom: 20px;
  min-width: 0;
}
.chat-timestamp {
  color: #667085;
  font-size: 13px;
}
.chat-message-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
  line-height: 1.5;
  flex-wrap: wrap;
}
.chat-delivery-status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #667085;
  font-size: 13px;
}
.chat-delivery-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.chat-segment {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.chat-segment-user {
  align-items: flex-end;
}
.chat-segment-text + .chat-segment-card,
.chat-segment-card + .chat-segment-card {
  margin-top: 12px;
}
.chat-segment + .chat-segment-text {
  margin-top: 16px;
}
.chat-bubble {
  box-sizing: border-box;
  max-width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  margin-bottom: 0;
  font-size: 16px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.chat-bubble-ai {
  width: auto;
  background: #f7f8fa;
  color: #1f2937;
}
.chat-bubble-user {
  max-width: 88%;
  background: #f4f4f5;
  color: #1f2937;
}
.chat-user-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.chat-card-stack {
  width: 100%;
  min-width: 0;
}
.chat-card-stack-dishes {
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.chat-dish-row + .chat-dish-row::before {
  content: '';
  display: block;
  height: 1px;
  margin: 0 14px;
  background: #e5e7eb;
}
.chat-card-stack-plans,
.chat-card-stack-preferences {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chat-reply-status {
  display: block;
  color: #667085;
  font-size: 13px;
  padding: 0 0 12px;
}
.chat-bottom-anchor {
  height: 1px;
}
.ai-chat-footer {
  position: relative;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 12px 20px 20px;
  background: #fff;
}
.chat-latest {
  position: absolute;
  z-index: 2;
  top: -48px;
  left: 50%;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  color: #667085;
  box-shadow: 0 3px 12px rgba(31, 41, 55, 0.16);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-50%) translateY(6px) scale(0.94);
  transition:
    opacity 140ms ease-in,
    transform 140ms ease-in,
    visibility 0s linear 140ms;
}
.chat-latest,
.chat-latest[disabled] {
  background: #fff;
  border: 0;
}
.chat-latest-visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0) scale(1);
  transition:
    opacity 180ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0s;
}
.chat-latest:active {
  transform: translateX(-50%) scale(0.94);
}
.chat-latest-icon {
  width: 20px;
  height: 20px;
}
@media (hover: hover) {
  .chat-latest:hover {
    background: #f7f8fa;
  }
  .chat-button:not(.chat-button-primary):not([disabled]):hover {
    background: #f7f8fa;
  }
  .chat-button-primary:not([disabled]):hover {
    background: #50065b;
  }
  .chat-history-open:hover,
  .chat-scene-option:hover {
    background: #f7f8fa;
  }
  .chat-history-delete:hover {
    color: #b42318;
  }
}
@media (prefers-reduced-motion: reduce) {
  .chat-latest,
  .chat-latest-visible,
  .chat-latest:active {
    transform: translateX(-50%);
  }
  .chat-latest {
    transition:
      opacity 80ms linear,
      visibility 0s linear 80ms;
  }
  .chat-latest-visible {
    transition:
      opacity 80ms linear,
      visibility 0s;
  }
}
.chat-state {
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.chat-state-title {
  font-size: 20px;
  font-weight: 650;
  line-height: 1.5;
}
.chat-state-description {
  display: block;
  color: #667085;
  font-size: 14px;
  line-height: 1.65;
}
.chat-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(31, 41, 55, 0.3);
  overflow: hidden;
  animation: chat-overlay-enter 160ms ease-out;
}
.chat-history-overlay {
  display: flex;
  justify-content: flex-end;
}
.chat-history {
  display: flex;
  flex-direction: column;
  width: 92%;
  max-width: 360px;
  height: 100%;
  background: #fff;
  animation: chat-history-enter 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.chat-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.chat-dialog-title {
  display: block;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.5;
}
.chat-history-list {
  flex: 1;
  min-height: 0;
  height: 0;
  padding: 8px 0;
  box-sizing: border-box;
}
.chat-history-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 8px 4px;
  border-radius: 10px;
}
.chat-history-current {
  background: #f7f8fa;
}
.chat-history-open {
  flex: 1;
  min-width: 0;
  display: block;
  margin: 0;
  padding: 12px;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 140ms ease-out;
}
.chat-history-open.chat-control-pressed,
.chat-scene-option.chat-control-pressed {
  background: #f4f4f5;
}
.chat-history-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.chat-history-title {
  display: block;
  flex: 1;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 15px;
  font-weight: 500;
}
.chat-history-current-label {
  flex-shrink: 0;
  font-size: 12px;
  color: #667085;
}
.chat-history-meta,
.chat-history-empty {
  display: block;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
.chat-history-meta {
  margin-top: 4px;
}
.chat-history-empty {
  padding: 32px 16px;
  text-align: center;
}
.chat-history-delete {
  flex-shrink: 0;
  color: #667085;
  width: 44px;
  padding: 0;
}
.chat-delete-icon {
  position: relative;
  width: 11px;
  height: 12px;
  border: 1.7px solid currentColor;
  border-top: 0;
  border-radius: 0 0 2px 2px;
}
.chat-delete-icon::before {
  content: '';
  position: absolute;
  width: 17px;
  height: 1.7px;
  top: -3px;
  left: -3px;
  border-radius: 1px;
  background: currentColor;
}
.chat-delete-icon::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 3px;
  top: -6px;
  left: 2px;
  border: 1.7px solid currentColor;
  border-bottom: 0;
  border-radius: 2px 2px 0 0;
}
.chat-close-icon {
  position: relative;
  width: 20px;
  height: 20px;
  color: #667085;
}
.chat-close-icon::before,
.chat-close-icon::after {
  content: '';
  position: absolute;
  top: 9px;
  left: 2px;
  width: 16px;
  height: 1.7px;
  border-radius: 1px;
  background: currentColor;
  transform: rotate(45deg);
}
.chat-close-icon::after {
  transform: rotate(-45deg);
}
.chat-modal-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}
.chat-dialog {
  box-sizing: border-box;
  width: 100%;
  max-width: 360px;
  max-height: 100%;
  overflow-y: auto;
  border-radius: 16px;
  background: #fff;
  padding: 20px;
  animation: chat-dialog-enter 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.chat-dialog .chat-state-description {
  margin-top: 6px;
}
.chat-scenes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 20px 0;
}
.chat-scene-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #fff;
  color: #1f2937;
  font-size: 15px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    border-color 140ms ease-out;
}
.chat-scene-selected {
  border-color: #d0d5dd;
  background: #f7f8fa;
}
.chat-scene-indicator {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #d0d5dd;
  border-radius: 50%;
  box-sizing: border-box;
}
.chat-scene-selected .chat-scene-indicator {
  border-color: #660874;
}
.chat-scene-check {
  width: 4px;
  height: 8px;
  margin-top: -2px;
  border: solid #660874;
  border-width: 0 1.7px 1.7px 0;
  transform: rotate(45deg);
}
.chat-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@keyframes chat-overlay-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes chat-history-enter {
  from {
    transform: translateX(20px);
  }
  to {
    transform: translateX(0);
  }
}
@keyframes chat-dialog-enter {
  from {
    transform: translateY(8px);
  }
  to {
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .chat-overlay,
  .chat-history,
  .chat-dialog {
    animation: none;
  }
  .chat-history-open,
  .chat-scene-option {
    transition: none;
  }
}
@media (max-height: 500px) {
  .ai-chat-footer {
    padding-top: 6px;
    padding-bottom: 8px;
  }
  .ai-chat-footer :deep(.suggestion-scroll) {
    display: none;
  }
}
@media (max-width: 340px) {
  .ai-chat-toolbar {
    padding-left: 16px;
    padding-right: 16px;
  }
  .ai-chat-transcript {
    padding-left: 16px;
    padding-right: 16px;
  }
  .ai-chat-footer {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
