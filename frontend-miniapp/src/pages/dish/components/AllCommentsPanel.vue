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
      aria-label="全部回复"
      @tap.stop
    >
      <view id="acp-header" class="sheet-header">
        <text class="sheet-title">全部回复</text>
        <button
          class="sheet-button sheet-close"
          aria-label="关闭回复"
          :disabled="submitting || closing"
          @tap="handleClose"
        >
          关闭
        </button>
      </view>
      <scroll-view
        class="sheet-body"
        scroll-y
        lower-threshold="80"
        @scrolltolower="loadMoreComments"
      >
        <view class="sheet-content reply-list" :aria-busy="loading">
          <view v-if="error && !comments.length" class="comment-state">
            <text class="sheet-error">{{ error }}</text
            ><button class="sheet-button" @tap="retryComments">重试</button>
          </view>
          <view
            v-else-if="initialized && !loading && !comments.length"
            class="comment-state sheet-hint"
            >还没有回复</view
          >
          <view
            v-for="comment in comments"
            :key="comment.id"
            class="comment-row"
            @longpress="handleLongPress($event, comment)"
          >
            <UserAvatar :src="comment.userAvatar" :size="32" :label="comment.userNickname" />
            <view class="comment-main">
              <view class="comment-heading">
                <text class="discussion-author comment-name">{{ comment.userNickname }}</text>
                <button
                  class="sheet-button discussion-action comment-more"
                  :aria-label="'管理 ' + comment.userNickname + ' 的回复'"
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
                >回复 @{{ comment.parentComment.userNickname }}</text
              >
              <text
                v-else-if="comment.parentComment?.deleted"
                class="sheet-hint comment-reply-context"
                >回复的评论已删除</text
              >
              <text class="discussion-body comment-content">{{ comment.content }}</text>
              <view class="discussion-meta comment-meta">
                <text>{{ comment.floor ?? '--' }}楼 · {{ formatDate(comment.createdAt) }}</text>
                <button
                  v-if="comment.status === 'approved' && canReply"
                  class="sheet-button discussion-action comment-reply-action"
                  :disabled="submitting"
                  @tap="selectCommentForReply(comment)"
                >
                  回复
                </button>
              </view>
            </view>
          </view>
          <view v-if="comments.length && (error || loading || hasMore)" class="comment-state">
            <template v-if="error"
              ><text class="sheet-error">{{ error }}</text
              ><button class="sheet-button" @tap="retryComments">重试</button></template
            >
            <text v-else-if="loading" class="sheet-hint">加载中…</text>
            <button v-else-if="hasMore" class="sheet-button" @tap="loadMoreComments">
              加载更多回复
            </button>
          </view>
        </view>
      </scroll-view>
      <view v-if="!initialized || canReply" id="acp-input" class="sheet-footer">
        <view v-if="replyingTo" class="reply-target">
          <text class="sheet-hint">回复 @{{ replyingTo.userNickname }}</text>
          <button
            class="sheet-button discussion-action"
            :disabled="submitting"
            aria-label="取消回复对象"
            @tap="cancelReply"
          >
            取消回复
          </button>
        </view>
        <view class="reply-composer">
          <input
            v-model="replyContent"
            class="sheet-input reply-input"
            aria-label="回复内容"
            :disabled="submitting"
            :adjust-position="false"
            maxlength="500"
            placeholder="写下你的回复"
            placeholder-style="color: #667085"
            @confirm="submitReply"
          />
          <button
            class="sheet-button sheet-primary reply-send"
            :disabled="!canSendReply"
            @tap="submitReply"
          >
            {{ submitting ? '发送中…' : '发送' }}
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
    title: '删除回复？',
    content: '删除后无法恢复。',
    confirmText: '删除',
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
    if (!(await confirmDiscardChanges(!!replyContent.value.trim(), '回复尚未发送，确定放弃吗？')))
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
.reply-target > text {
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
