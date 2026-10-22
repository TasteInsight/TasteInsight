<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-container
    v-if="isVisible"
    :key="helperKey"
    :show="isVisible"
    :overlay="false"
    :duration="0"
    custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
    @leave="handleClose"
    @afterleave="restoreHelper"
  />
  <!-- #endif -->
  <view v-if="isVisible" class="review-overlay" :style="keyboardStyle" @tap="handleClose">
    <view
      id="acp-root"
      class="review-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="t('food.allReplies')"
      @tap.stop
    >
      <view id="acp-header" class="sheet-header">
        <text class="sheet-title">{{ t('food.allReplies') }}</text>
        <button
          class="sheet-button sheet-close"
          :aria-label="t('food.closeReplies')"
          :class="{ 'is-disabled': submitting || closing }"
          :disabled="submitting || closing"
          @tap="handleClose"
        >
          {{ t('food.close') }}
        </button>
      </view>
      <scroll-view
        class="sheet-body"
        scroll-y
        lower-threshold="80"
        @scrolltolower="loadMoreComments"
      >
        <view class="sheet-content reply-list" :aria-busy="loading">
          <view v-if="error && !comments.length" class="error-feedback" role="alert">
            <text class="error-feedback__message">{{ error }}</text
            ><button
              class="error-feedback__action"
              hover-class="error-feedback__action--pressed"
              @tap="retryComments"
            >
              {{ t('food.retry2') }}
            </button>
          </view>
          <view
            v-else-if="initialized && !loading && !comments.length"
            class="comment-state sheet-hint"
            >{{ t('food.noRepliesYet') }}</view
          >
          <view
            v-for="comment in comments"
            :key="comment.id"
            class="comment-row"
            @longpress="handleLongPress($event, comment)"
          >
            <!-- #ifndef MP-WEIXIN -->
            <button
              class="comment-author-avatar"
              :aria-label="t('food.viewProfile', { name: comment.userNickname })"
              @tap.stop="openAuthor(comment.userId)"
            >
              <UserAvatar :src="comment.userAvatar" :size="32" :label="comment.userNickname" />
            </button>
            <!-- #endif -->
            <!-- #ifdef MP-WEIXIN -->
            <UserAvatar :src="comment.userAvatar" :size="32" :label="comment.userNickname" />
            <!-- #endif -->
            <view class="comment-main">
              <view class="comment-heading">
                <!-- #ifndef MP-WEIXIN -->
                <button
                  class="comment-author-name discussion-author comment-name"
                  @tap.stop="openAuthor(comment.userId)"
                >
                  {{ comment.userNickname }}
                </button>
                <!-- #endif -->
                <!-- #ifdef MP-WEIXIN -->
                <text class="discussion-author comment-name">{{ comment.userNickname }}</text>
                <!-- #endif -->
                <button
                  class="sheet-button discussion-action comment-more"
                  :aria-label="t('food.manageReply', { name: comment.userNickname })"
                  aria-haspopup="dialog"
                  role="button"
                  tabindex="0"
                  @tap.stop="handleLongPress($event, comment)"
                  @keydown.enter.stop.prevent="handleLongPress($event, comment)"
                  @keydown.space.stop.prevent="handleLongPress($event, comment)"
                >
                  <image
                    class="discussion-more-icon"
                    src="/static/icons/more-horizontal.png"
                    mode="aspectFit"
                    aria-hidden="true"
                  />
                </button>
              </view>
              <text
                v-if="comment.parentComment && !comment.parentComment.deleted"
                class="sheet-hint comment-reply-context"
                >{{
                  t('food.replyToUser', { name: comment.parentComment.userNickname ?? '' })
                }}</text
              >
              <text
                v-else-if="comment.parentComment?.deleted"
                class="sheet-hint comment-reply-context"
                >{{ t('food.originalCommentDeleted') }}</text
              >
              <text class="discussion-body comment-content">{{ comment.content }}</text>
              <view class="discussion-meta comment-meta">
                <text>{{
                  t('food.replyFloorAndDate', {
                    floor: comment.floor ?? '--',
                    date: formatDate(comment.createdAt),
                  })
                }}</text>
                <view class="comment-actions">
                  <button
                    v-if="comment.status === 'approved' && canReply"
                    class="sheet-button discussion-action comment-like"
                    :class="[
                      { 'comment-liked': isLiked(comment) },
                      { 'is-disabled': !!pending[comment.id] },
                    ]"
                    :aria-label="isLiked(comment) ? t('food.unlike') : t('food.likeReply')"
                    :aria-pressed="isLiked(comment)"
                    :disabled="!!pending[comment.id]"
                    @tap.stop="toggleLike(comment)"
                  >
                    <text class="iconfont icon-heart-outline" aria-hidden="true" />{{
                      likeCount(comment) || t('food.like')
                    }}
                  </button>
                  <button
                    v-if="comment.status === 'approved' && canReply"
                    class="sheet-button discussion-action comment-reply-action"
                    :class="{ 'is-disabled': submitting }"
                    :disabled="submitting"
                    @tap="selectCommentForReply(comment)"
                  >
                    {{ t('food.reply') }}
                  </button>
                </view>
              </view>
            </view>
          </view>
          <view
            v-if="comments.length && (error || loading || hasMore)"
            :class="error ? 'error-feedback' : 'comment-state'"
          >
            <template v-if="error"
              ><text class="error-feedback__message">{{ error }}</text
              ><button
                class="error-feedback__action"
                hover-class="error-feedback__action--pressed"
                @tap="retryComments"
              >
                {{ t('food.retry2') }}
              </button></template
            >
            <text v-else-if="loading" class="sheet-hint">{{ t('food.loading') }}</text>
            <button v-else-if="hasMore" class="sheet-button" @tap="loadMoreComments">
              {{ t('food.loadMoreReplies') }}
            </button>
          </view>
        </view>
      </scroll-view>
      <view v-if="!initialized || canReply" id="acp-input" class="sheet-footer">
        <view v-if="replyingTo" class="reply-target">
          <text class="sheet-hint">{{
            t('food.replyToUser', { name: replyingTo.userNickname })
          }}</text>
          <button
            class="sheet-button discussion-action"
            :class="{ 'is-disabled': submitting }"
            :disabled="submitting"
            :aria-label="t('food.cancelReplyRecipient')"
            @tap="cancelReply"
          >
            {{ t('food.cancelReply') }}
          </button>
        </view>
        <view class="reply-composer">
          <input
            v-model="replyContent"
            class="sheet-input reply-input"
            :aria-label="t('food.replyText')"
            :disabled="submitting"
            :adjust-position="false"
            maxlength="500"
            :placeholder="t('food.writeAReply')"
            placeholder-style="color: #667085"
            @confirm="submitReply"
          />
          <button
            class="sheet-button sheet-primary reply-send"
            :class="{ 'is-disabled': !canSendReply }"
            :disabled="!canSendReply"
            @tap="submitReply"
          >
            {{ submitting ? t('food.sending') : t('food.send') }}
          </button>
        </view>
      </view>
    </view>
    <LongPressMenu
      :visible="menuVisible"
      :can-delete="canDeleteCurrent"
      @close="closeMenu"
      @delete="confirmDelete"
      @report="handleReportFromMenu"
    />
    <ReportDialog
      v-if="isReportVisible"
      ref="reportRef"
      :submitting="reportSubmitting"
      @close="closeReportModal"
      @submit="submitReport"
    />
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { ref, watch, computed, onUnmounted } from 'vue';
import type { Comment } from '@/types/api';
import dayjs from 'dayjs';
import { useUserStore } from '@/store/modules/use-user-store';
import UserAvatar from '@/components/UserAvatar.vue';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import ReportDialog from './ReportDialog.vue';
import LongPressMenu from './LongPressMenu.vue';
import { useReport } from '../composables/use-report';
import { useCommentPanel } from '../composables/use-comment';
import { useSheetKeyboard } from '../composables/use-sheet-keyboard';
import { setCommentLike } from '@/api/modules/comment';
import { useContentLike } from '../composables/use-content-like';

const props = defineProps<{ reviewId: string; isVisible: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'commentAdded'): void }>();
const userStore = useUserStore();
const keyboardStyle = useSheetKeyboard();
const {
  comments,
  initialized,
  loading,
  error,
  hasMore,
  replyContent,
  replyingTo,
  canSendReply,
  canReply,
  submitting,
  fetchPanelComments,
  retryComments,
  loadMoreComments,
  selectCommentForReply,
  cancelReply,
  submitReply,
  resetPanel,
  removePanelComment,
} = useCommentPanel(
  () => props.reviewId,
  () => emit('commentAdded')
);
const { pending, isLiked, likeCount, toggleLike, resetLikes } = useContentLike(
  () => comments.value,
  setCommentLike
);
// #ifndef MP-WEIXIN
const openAuthor = (id: string) =>
  uni.navigateTo({ url: `/pages/profile/public?id=${encodeURIComponent(id)}` });
// #endif
const {
  isReportVisible,
  submitting: reportSubmitting,
  openReportModal,
  closeReportModal,
  submitReport,
} = useReport();
const reportRef = ref<InstanceType<typeof ReportDialog> | null>(null);
const menuVisible = ref(false);
const currentComment = ref<Comment | null>(null);
const closing = ref(false);
const helperKey = ref(0);
let active = true;
onUnmounted(() => {
  active = false;
});
const canDeleteCurrent = computed(() => currentComment.value?.userId === userStore.userInfo?.id);
const handleLongPress = (_event: any, comment: Comment) => {
  currentComment.value = comment;
  menuVisible.value = true;
};
const closeMenu = () => {
  menuVisible.value = false;
  currentComment.value = null;
};
const confirmDelete = () => {
  const comment = currentComment.value;
  closeMenu();
  if (!comment || comment.userId !== userStore.userInfo?.id) return;
  const session = userStore.sessionVersion;
  const review = props.reviewId;
  uni.showModal({
    title: t('food.deleteReply'),
    content: t('food.thisReplyWillBePermanentlyDeleted'),
    confirmText: t('common.modal.delete'),
    success: result => {
      if (
        result.confirm &&
        active &&
        props.isVisible &&
        review === props.reviewId &&
        session === userStore.sessionVersion
      )
        void removePanelComment(comment.id);
    },
  });
};
const handleReportFromMenu = () => {
  const id = currentComment.value?.id;
  closeMenu();
  if (id) openReportModal('comment', id);
};
watch(
  [() => props.isVisible, () => props.reviewId],
  ([visible]) => {
    resetLikes();
    resetPanel();
    closeMenu();
    closeReportModal();
    if (visible) void fetchPanelComments();
  },
  { immediate: true, flush: 'sync' }
);
const handleClose = async () => {
  if (isReportVisible.value) return reportRef.value?.requestClose();
  if (menuVisible.value) {
    closeMenu();
    return false;
  }
  if (submitting.value || closing.value) return false;
  const session = userStore.sessionVersion;
  const review = props.reviewId;
  closing.value = true;
  try {
    if (
      !(await confirmDiscardChanges(!!replyContent.value.trim(), t('food.discardThisUnsentReply')))
    )
      return false;
    if (!active || session !== userStore.sessionVersion || review !== props.reviewId) return false;
    emit('close');
    return true;
  } finally {
    closing.value = false;
  }
};
const restoreHelper = () => {
  if (props.isVisible && active) helperKey.value++;
};
const formatDate = (date: string) => dayjs(date).format('MM-DD HH:mm');
defineExpose({ requestClose: handleClose });
</script>

<style scoped>
@import './review-sheet.css';
@import './discussion.css';
.reply-list {
  padding: 0 16px 12px;
}
.comment-state {
  padding: 24px 0;
  text-align: center;
}
.comment-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}
.comment-main {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.comment-heading,
.comment-meta,
.reply-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.comment-heading {
  min-height: 32px;
}
.comment-name {
  min-width: 0;
}
.comment-author-avatar,
.comment-author-name {
  display: flex;
  align-items: center;
  min-height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #1f2937;
  font: inherit;
  line-height: inherit;
  text-align: left;
}
.comment-author-avatar {
  flex-shrink: 0;
}
.comment-author-avatar::after,
.comment-author-name::after {
  border: 0;
}
.comment-author-avatar:focus-visible,
.comment-author-name:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.comment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.comment-like {
  gap: 4px;
}
.comment-liked {
  color: #660874;
}
.comment-more {
  margin: -6px 0;
}
.comment-reply-context {
  margin-top: 8px;
}
.comment-content {
  display: block;
  margin-top: 8px;
}
.comment-meta {
  min-height: 32px;
  margin-top: 8px;
}
.comment-reply-action {
  margin: -6px 0;
}
.reply-target {
  margin-bottom: 8px;
}
.reply-target > .sheet-hint {
  min-width: 0;
  overflow-wrap: anywhere;
}
.reply-composer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.reply-input {
  min-width: 0;
  flex: 1;
  height: 44px;
  padding: 8px 12px;
  line-height: 22px;
  caret-color: #660874;
}
.reply-input:focus,
.reply-input:focus-within {
  outline: none;
  box-shadow: inset 0 0 0 1px #660874;
}
.reply-send {
  width: auto;
  flex-shrink: 0;
}
</style>
