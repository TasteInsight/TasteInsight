<template>
  <view class="ai-chat-page page-viewport">
    <!-- #ifdef APP-PLUS -->
    <AppTextStream v-if="useAndroidStream" ref="appTextStream" />
    <!-- #endif -->
    <view v-if="isLoggedIn" class="ai-chat-toolbar">
      <button
        class="chat-button chat-toolbar-action chat-toolbar-new"
        hover-class="chat-control-pressed"
        :hover-stay-time="80"
        role="button"
        tabindex="0"
        :aria-label="t('social.newConversation')"
        @click="handleNewChat"
        @keydown="handleActionKeydown"
        @keyup="handleActionKeyup($event, handleNewChat)"
        @blur="keyPressed = false"
      >
        <image class="chat-tool-icon" src="/static/icons/chat-new.png" aria-hidden="true" />
        <text>{{ t('social.newConversation') }}</text>
      </button>
      <button
        class="chat-button chat-toolbar-action chat-toolbar-history"
        hover-class="chat-control-pressed"
        :hover-stay-time="80"
        role="button"
        tabindex="0"
        :aria-label="t('social.conversationHistory')"
        @click="openHistory"
        @keydown="handleActionKeydown"
        @keyup="handleActionKeyup($event, openHistory)"
        @blur="keyPressed = false"
      >
        <image class="chat-tool-icon" src="/static/icons/history.png" aria-hidden="true" />
        <text>{{ t('social.history') }}</text>
      </button>
    </view>
    <LoginGate :title="t('social.aiLogin')" icon="chat">
      <scroll-view
        ref="messageScroller"
        scroll-y
        :show-scrollbar="false"
        class="ai-chat-messages"
        :scroll-into-view="scrollIntoViewId"
        :scroll-with-animation="false"
        @scroll="handleScroll"
        @scrolltolower="handleScrollToLower"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @keydown="handleReadingKeydown"
      >
        <view class="ai-chat-transcript" :class="{ 'chat-transcript-state': !messages.length }">
          <AsyncState
            :loading="isInitialLoading"
            :initialized="!isInitialLoading && !isInitializing"
            :has-content="!!messages.length"
            :error="initialError"
            :error-title="t('social.connectionUnavailable')"
            :loading-title="t('social.connectingAi')"
            :empty-title="t('social.whatToEat')"
            :retry-text="t('social.retryConnection')"
            @retry="retryConnection"
          >
            <template #empty>
              <view class="chat-state">
                <text class="chat-state-title">{{ t('social.whatToEat') }}</text>
                <text class="chat-state-description">{{ t('social.chatIntroduction') }}</text>
              </view>
            </template>
          </AsyncState>
          <template v-if="messages.length">
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
                    <text v-else :user-select="true" class="chat-user-text">{{
                      segment.text
                    }}</text>
                  </view>
                  <view
                    v-else-if="segment.type === 'card_dish'"
                    class="chat-card-stack chat-card-stack-dishes list-row-group"
                    role="group"
                    :aria-label="t('social.recommendedDishes')"
                  >
                    <template v-for="(dish, dishIndex) in segment.data" :key="dishIndex">
                      <view v-if="dish?.dish" class="chat-dish-row list-row-group-item"
                        ><DishCard :dish="dish"
                      /></view>
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
                  <view
                    v-else-if="segment.type === 'card_canteen'"
                    class="chat-card-stack list-row-group"
                  >
                    <view v-for="(canteen, i) in segment.data" :key="i" class="list-row-group-item"
                      ><CanteenCard :canteen="canteen"
                    /></view>
                  </view>
                  <view
                    v-else-if="segment.type === 'card_window'"
                    class="chat-card-stack list-row-group"
                  >
                    <view v-for="(window, i) in segment.data" :key="i" class="list-row-group-item"
                      ><WindowCard :window="window"
                    /></view>
                  </view>
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
              <text
                v-if="message.type === 'ai' && message.replyStatus"
                class="chat-message-status"
                role="status"
                >{{ replyStates[message.replyStatus] }}</text
              >
            </view>
            <text v-if="aiLoading" class="chat-reply-status" role="status">{{
              t('social.replying')
            }}</text>
          </template>
          <SuggestionChips
            v-if="suggestions.length && !aiLoading"
            :suggestions="suggestions"
            :disabled="sending || isInitializing"
            @select="handleSuggestionSelect"
          />
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
          :aria-label="t('social.scrollToLatest')"
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
        <InputBar
          v-model="draft"
          :loading="aiLoading"
          :busy="sending || isInitializing"
          @send="handleSend"
          @stop="handleStopStreaming"
          @focus="scrollToBottom"
          @blur="scrollToBottom"
        />
        <text class="chat-content-notice">{{ t('social.aiDisclaimer') }}</text>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <page-container
        :show="showHistory || showNewChatModal"
        :overlay="false"
        :duration="0"
        custom-style="position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;"
        @leave="closeChatOverlay"
      />
      <!-- #endif -->
      <view v-if="showHistory" class="chat-overlay chat-history-overlay" @click="closeHistory">
        <view
          class="chat-history"
          role="dialog"
          :aria-label="t('social.conversationHistory')"
          @click.stop
        >
          <view class="chat-dialog-header"
            ><text class="chat-dialog-title">{{ t('social.conversationHistory') }}</text
            ><button
              class="chat-button"
              hover-class="chat-control-pressed"
              :hover-stay-time="80"
              role="button"
              tabindex="0"
              :aria-label="t('social.closeHistory')"
              @click="closeHistory"
              @keydown="handleActionKeydown"
              @keyup="handleActionKeyup($event, closeHistory)"
              @blur="keyPressed = false"
            >
              <view class="chat-close-icon" aria-hidden="true" /></button
          ></view>
          <scroll-view scroll-y :show-scrollbar="false" class="chat-history-list">
            <text v-if="!historyEntries.length" class="chat-history-empty">{{
              t('social.noHistory')
            }}</text>
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
                :aria-label="
                  t('social.openConversation', { p0: item.title || t('social.conversation') })
                "
                @click="handleLoadHistory(item.sessionId)"
                @keydown="handleActionKeydown"
                @keyup="handleActionKeyup($event, () => handleLoadHistory(item.sessionId))"
                @blur="keyPressed = false"
              >
                <view class="chat-history-heading">
                  <text class="chat-history-title">{{
                    item.title || t('social.conversation')
                  }}</text>
                  <text
                    v-if="item.sessionId === currentSessionId"
                    class="chat-history-current-label"
                    >{{ t('social.current') }}</text
                  >
                </view>
                <text class="chat-history-meta"
                  >{{ t(sceneLabelMap[item.scene] || 'social.conversation') }} ·
                  {{ formatTime(item.updatedAt) }}</text
                >
              </button>
              <button
                class="chat-button chat-history-delete"
                hover-class="chat-control-pressed"
                :hover-stay-time="80"
                role="button"
                tabindex="0"
                :aria-label="
                  t('social.deleteConversationLabel', {
                    p0: item.title || t('social.conversation'),
                  })
                "
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
        <view
          class="chat-dialog"
          role="dialog"
          :aria-label="t('social.startNewConversation')"
          @click.stop
        >
          <text class="chat-dialog-title">{{ t('social.newConversation') }}</text
          ><text class="chat-state-description">{{ t('social.chooseConversationTopic') }}</text>
          <view class="chat-scenes" role="group" :aria-label="t('social.conversationTopics')"
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
                <UiIcon
                  v-if="selectedScene === option.value"
                  name="check"
                  :size="16"
                  tone="primary"
                />
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
              {{ t('social.cancel') }}</button
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
              {{ t('social.startConversation') }}
            </button></view
          >
        </view>
      </view>
    </LoginGate>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import UiIcon from '@/components/UiIcon.vue';
import { toUserFriendlyErrorMessage } from '@/utils/user-friendly-error';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
import { computed, ref, watch, nextTick, onScopeDispose } from 'vue';
import { onShow } from '@dcloudio/uni-app';
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
import type { TextStreamTransport } from '@/utils/text-stream';
// #ifdef APP-PLUS
import AppTextStream from '@/components/AppTextStream.vue';
const appTextStream = ref<InstanceType<typeof AppTextStream> | null>(null);
const useAndroidStream = typeof plus !== 'undefined' && plus.os.name === 'Android';
// #endif
let transport: TextStreamTransport | undefined;
// #ifdef APP-PLUS
if (useAndroidStream) transport = options => appTextStream.value!.start(options);
// #endif
const {
  isLoggedIn,
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
} = useChat(transport);
onShow(() => {
  if (isLoggedIn.value && !currentSessionId.value && !isInitializing.value) void init();
});
const draft = ref('');
const sending = ref(false);
const scrollIntoViewId = ref('');
const messageScroller = ref<{ $el?: HTMLElement } | null>(null);
const followingLatest = ref(true);
const showHistory = ref(false);
const showNewChatModal = ref(false);
const selectedScene = ref<AIScene>('general_chat');
watch(
  isLoggedIn,
  loggedIn => {
    if (loggedIn) return;
    draft.value = '';
    showHistory.value = false;
    showNewChatModal.value = false;
  },
  { flush: 'sync' }
);
const sceneOptions = computed<{ value: AIScene; label: string }[]>(() => [
  { value: 'general_chat', label: t('social.foodChat') },
  { value: 'dish_critic', label: t('social.dishCritic') },
  { value: 'meal_planner', label: t('social.mealPlanner') },
]);
const sceneLabelMap: Record<string, string> = {
  general_chat: 'social.foodChat',
  dish_critic: 'social.dishCritic',
  meal_planner: 'social.mealPlanner',
};
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
const handleScrollbarPointer = (event: MouseEvent) => {
  if (event.button === 0 && (event.target as HTMLElement).scrollTop > 0) pauseFollowing();
};
watch(
  () => messageScroller.value?.$el,
  (element, _, onCleanup) => {
    if (!element) return;
    element.addEventListener('wheel', handleWheel, { passive: true });
    element.addEventListener('mousedown', handleScrollbarPointer);
    onCleanup(() => {
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('mousedown', handleScrollbarPointer);
    });
  },
  { flush: 'post' }
);
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
watch(suggestions, scrollToBottom);
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
    } else uni.showToast({ title: t('social.messageSendRetry'), icon: 'none' });
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
const closeChatOverlay = () => {
  closeHistory();
  cancelNewChat();
};
const handleLoadHistory = (sessionId: string) =>
  loadHistorySession(sessionId, loaded => {
    if (loaded) {
      closeHistory();
      returnToLatest();
    } else uni.showToast({ title: t('social.loadHistoryFailed'), icon: 'none' });
  });
const handleDeleteHistory = (sessionId: string) => {
  const item = historyEntries.value.find(entry => entry.sessionId === sessionId);
  const ownsOperation = captureOperation();
  return new Promise<boolean | undefined>(resolve =>
    uni.showModal({
      title: t('social.deleteConversation'),
      content: t('social.deleteConversationQuestion', {
        p0: item?.title || t('social.conversation'),
      }),
      confirmText: t('social.delete'),
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
  uni.showLoading({ title: t('social.addingPlan') });
  try {
    const applied = await applyMealPlan(plan);
    if (!isCurrent()) return;
    releaseApplyLoading();
    if (!applied) return;
    uni.showToast({ title: t('social.addedToPlans'), icon: 'success' });
    planFollowUpTimer = setTimeout(() => {
      planFollowUpTimer = null;
      if (isCurrent()) void sendMessage(t('social.planAppliedPrompt'));
    }, 500);
  } catch (error) {
    if (!isCurrent()) return;
    releaseApplyLoading();
    uni.showToast({ title: toUserFriendlyErrorMessage(error), icon: 'none' });
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
const replyStates = computed(() => ({
  failed: t('social.replyFailed'),
  stopped: t('social.replyStopped'),
  interrupted: t('social.replyInterrupted'),
}));
const deliveryStates = computed<Record<string, { label: string; icon?: string; text?: string }>>(
  () => ({
    sending: { label: t('social.messageSending'), icon: '/static/icons/history.png' },
    received: { label: t('social.messageReceived'), icon: '/static/icons/check-double.png' },
    failed: {
      label: t('social.messageDeliveryError'),
      icon: '/static/icons/alert.png',
      text: t('social.messageDeliveryError'),
    },
    unconfirmed: { label: t('social.messageUnconfirmed'), text: t('social.messageUnconfirmed') },
  })
);
const deliveryFor = (message: { type: string; deliveryStatus?: string }) =>
  message.type === 'user' && message.deliveryStatus
    ? deliveryStates.value[message.deliveryStatus]
    : undefined;
</script>
<style scoped>
.chat-transcript-state {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.ai-chat-page {
  --chat-accent: #660874;
  position: relative;
}
.ai-chat-toolbar {
  flex-shrink: 0;
  width: 100%;
  max-width: var(--page-content-width);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 6px 20px 12px;
  background: #fff;
}
.chat-tool-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.ai-chat-toolbar .chat-toolbar-action {
  position: relative;
  z-index: 0;
  gap: 6px;
  padding: 0 8px;
  background: transparent;
  color: #1f2937;
}
.ai-chat-toolbar .chat-toolbar-action::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 6px 0;
  border-radius: 8px;
  background: transparent;
  pointer-events: none;
  transition: background-color 140ms ease-out;
}
.ai-chat-toolbar .chat-toolbar-action.chat-control-pressed {
  background: transparent;
}
.ai-chat-toolbar .chat-toolbar-action.chat-control-pressed::before {
  background: #f4f4f5;
}
.ai-chat-toolbar .chat-toolbar-action:focus-visible {
  outline: none;
}
.ai-chat-toolbar .chat-toolbar-action:focus-visible::before {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
@media (hover: hover) {
  .ai-chat-toolbar .chat-toolbar-action:hover {
    background: transparent;
  }
  .ai-chat-toolbar .chat-toolbar-action:hover::before {
    background: #f7f8fa;
  }
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
.chat-button.chat-control-pressed {
  background: #f4f4f5;
}
.chat-button-primary.chat-control-pressed {
  background: #50065b;
  color: #fff;
}
@media (prefers-reduced-motion: reduce) {
  .chat-button,
  .ai-chat-toolbar .chat-toolbar-action::before {
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
  max-width: var(--page-content-width);
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
.chat-card-stack-plans,
.chat-card-stack-preferences {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chat-message-status {
  display: block;
  margin-top: 0;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 20px;
}
.chat-segment ~ .chat-message-status {
  margin-top: 8px;
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
  max-width: var(--page-content-width);
  margin: 0 auto;
  padding: 12px 20px 20px;
  background: #fff;
}
.chat-content-notice {
  display: block;
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
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
.chat-latest {
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
  .chat-button:not(.chat-button-primary):hover {
    background: #f7f8fa;
  }
  .chat-button-primary:hover {
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
