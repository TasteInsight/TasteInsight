<template>
  <view class="campus-page page-content page-state-layout post-detail" :aria-busy="loading">
    <AsyncState
      :loading="loading"
      :has-content="!!post"
      :error="errorText"
      :loading-title="t('social.loadingPosts')"
      @retry="load"
    />
    <template v-if="post">
      <PostCard :post="post" detail @manage="managePost" @reply="focusReply" />
      <view class="reply-heading"
        ><text class="reply-title">{{ t('social.reply') }}</text
        ><text v-if="commentsReady" class="campus-hint">{{ totalComments }}</text></view
      >
      <AsyncState
        :loading="commentsLoading"
        :initialized="commentsReady"
        :has-content="comments.length > 0"
        :error="commentsErrorText"
        :loading-title="t('social.loadingReplies')"
        :empty-title="canReply ? t('social.noRepliesDiscussion') : t('social.noReplies')"
        empty-icon="chat"
        :retry-text="t('social.retry')"
        @retry="loadComments(commentsFailedAppend)"
      />
      <view v-for="comment in comments" :key="comment.id" class="post-reply">
        <button
          class="campus-button reply-avatar"
          :aria-label="t('social.profileLabel', { name: comment.userNickname })"
          @click="openProfile(comment.userId)"
        >
          <UserAvatar :src="comment.userAvatar" :size="32" :label="comment.userNickname" />
        </button>
        <view class="reply-main">
          <view class="reply-top"
            ><button class="campus-button reply-name" @click="openProfile(comment.userId)">
              {{ comment.userNickname }}</button
            ><button
              class="campus-button reply-menu"
              :aria-label="t('social.manageReplyLabel', { name: comment.userNickname })"
              @click="manageComment(comment)"
            >
              <image src="/static/icons/more-horizontal.png" mode="aspectFit" /></button
          ></view>
          <text v-if="comment.parentComment" class="campus-hint">{{
            comment.parentComment.deleted
              ? t('social.parentReplyDeleted')
              : t('social.replyToPrefix') + comment.parentComment.userNickname
          }}</text>
          <text class="reply-content" selectable>{{ comment.content }}</text>
          <view class="reply-bottom"
            ><text class="campus-hint reply-date">{{ formatDate(comment.createdAt) }}</text
            ><view class="reply-actions"
              ><button
                v-if="canReply && comment.status === 'approved'"
                class="campus-button reply-action"
                :class="{ 'reply-liked': isLiked(comment) }"
                :aria-pressed="isLiked(comment)"
                :aria-label="isLiked(comment) ? t('social.unlike') : t('social.likeReply')"
                :disabled="!!pending[comment.id]"
                @click="toggleLike(comment)"
              >
                <text class="iconfont icon-heart-outline" aria-hidden="true" />{{
                  likeCount(comment) || t('social.like')
                }}</button
              ><button
                v-if="canReply && comment.status === 'approved'"
                class="campus-button reply-action"
                :disabled="submitting"
                @click="selectReply(comment)"
              >
                {{ t('social.reply') }}
              </button></view
            ></view
          >
        </view>
      </view>
      <button
        v-if="!commentsErrorText && hasMore"
        class="campus-button campus-more"
        :disabled="commentsLoading"
        @click="loadComments(true)"
      >
        {{ commentsLoading ? t('social.loadingMore') : t('social.loadMoreReplies') }}
      </button>
      <view v-if="canReply" id="post-reply-composer" class="post-composer">
        <view v-if="replyingTo" class="reply-target"
          ><text class="campus-hint"
            >{{ t('social.replyToPrefix') }}{{ replyingTo.userNickname }}</text
          ><button class="campus-button" :disabled="submitting" @click="replyingTo = null">
            {{ t('social.cancelReply') }}
          </button></view
        >
        <view class="reply-composer-row">
          <textarea
            v-model="content"
            class="post-reply-input"
            :focus="replyFocused"
            :disabled="submitting"
            maxlength="500"
            auto-height
            :aria-label="t('social.replyContent')"
            :placeholder="t('social.replyPlaceholder')"
            placeholder-style="color: #667085"
            @blur="replyFocused = false"
          /><button
            class="campus-button campus-primary"
            :disabled="!content.trim() || submitting"
            @click="sendReply"
          >
            {{ submitting ? t('social.sending') : t('social.send') }}
          </button></view
        >
      </view>
    </template>
    <ReportDialog
      v-if="reportTarget"
      ref="reportDialog"
      :submitting="reportSubmitting"
      @close="reportTarget = null"
      @submit="submitReport"
    />
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { openCampus } from '@/utils/campus-navigation';
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';
import {
  onLoad,
  onShow,
  onHide,
  onPullDownRefresh,
  onReachBottom,
  onBackPress,
} from '@dcloudio/uni-app';
import dayjs from 'dayjs';
import {
  getPost,
  getPostComments,
  deletePost,
  createPostComment,
  deletePostComment,
  reportPost,
  reportPostComment,
  setPostCommentLike,
  type Post,
  type PostComment,
} from '@/api/modules/social';
import type { ReportRequest } from '@/types/api';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import { useContentLike } from '@/composables/use-content-like';
import UserAvatar from '@/components/UserAvatar.vue';
import AsyncState from '@/components/AsyncState.vue';
import ReportDialog from '@/components/ReportDialog.vue';
import PostCard from './components/PostCard.vue';

const user = useUserStore();
const id = ref('');
const post = ref<Post | null>(null);
const loading = ref(false);
const error = ref('');
const errorText = computed(() =>
  error.value.startsWith('social.') ? t(error.value) : error.value
);
const comments = ref<PostComment[]>([]);
const commentsLoading = ref(false);
const commentsReady = ref(false);
const commentsError = ref('');
const commentsErrorText = computed(() =>
  commentsError.value.startsWith('social.') ? t(commentsError.value) : commentsError.value
);
const page = ref(0);
const totalPages = ref(0);
const totalComments = ref(0);
const hasMore = computed(() => page.value < totalPages.value);
const canReply = ref(false);
const content = ref('');
const replyingTo = ref<PostComment | null>(null);
const replyFocused = ref(false);
const submitting = ref(false);
const reportTarget = ref<{ type: 'post' | 'comment'; id: string } | null>(null);
const reportSubmitting = ref(false);
const reportDialog = ref<InstanceType<typeof ReportDialog> | null>(null);
const { pending, isLiked, likeCount, toggleLike, resetLikes } = useContentLike(
  () => comments.value,
  setPostCommentLike
);
let active = true;
let visible = true;
let epoch = 0;
let postRequest = 0;
let commentsRequest = 0;
let commentsFailedAppend = false;
let leaving = false;
let checkingLeave = false;
const capture = () => {
  const session = user.sessionVersion;
  const version = epoch;
  return () => active && visible && version === epoch && session === user.sessionVersion;
};
const captureWrite = () => {
  const session = user.sessionVersion;
  return () => active && session === user.sessionVersion;
};
const mergeComments = (items: PostComment[]) =>
  Array.from(new Map(items.map(item => [item.id, item])).values()).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
const formatDate = (value: string) => dayjs(value).format('MM-DD HH:mm');
const openProfile = (userId: string) =>
  uni.navigateTo({ url: `/pages/profile/public?id=${encodeURIComponent(userId)}` });
async function load() {
  if (!id.value) {
    error.value = 'social.postNotFound';
    return;
  }
  const current = capture();
  const request = ++postRequest;
  loading.value = true;
  error.value = '';
  try {
    const response = await getPost(id.value);
    if (!current() || request !== postRequest) return;
    if (response.code !== 200) throw new Error(response.message || 'social.loadPostFailed');
    post.value = response.data;
  } catch (cause) {
    if (current() && request === postRequest) {
      error.value = cause instanceof Error ? cause.message : 'social.loadPostsRetry';
    }
    return;
  } finally {
    if (current() && request === postRequest) loading.value = false;
  }
  await loadComments();
}
async function loadComments(append = false) {
  if (!post.value || (append && (commentsLoading.value || !hasMore.value))) return;
  const current = capture();
  const request = ++commentsRequest;
  commentsLoading.value = true;
  commentsError.value = '';
  try {
    const response = await getPostComments(id.value, {
      page: append ? page.value + 1 : 1,
      pageSize: 20,
    });
    if (!current() || request !== commentsRequest) return;
    if (response.code !== 200) throw new Error(response.message || 'social.loadRepliesFailed');
    const incoming = new Set(response.data.items.map(item => item.id));
    comments.value = mergeComments([
      ...(append ? comments.value.filter(item => !incoming.has(item.id)) : []),
      ...response.data.items,
    ]);
    page.value = response.data.meta.page;
    totalPages.value = response.data.meta.totalPages;
    totalComments.value = response.data.meta.total;
    canReply.value = response.data.canReply;
    commentsReady.value = true;
  } catch (cause) {
    if (current() && request === commentsRequest) {
      commentsFailedAppend = append;
      commentsError.value = cause instanceof Error ? cause.message : 'social.loadRepliesRetry';
    }
  } finally {
    if (current() && request === commentsRequest) commentsLoading.value = false;
  }
}
async function focusReply() {
  if (!canReply.value || !requireStudent()) return;
  replyFocused.value = false;
  await nextTick();
  replyFocused.value = true;
  uni.pageScrollTo({ selector: '#post-reply-composer', duration: 200 });
}
function selectReply(comment: PostComment) {
  if (!requireStudent()) return;
  replyingTo.value = comment;
  void focusReply();
}
async function sendReply() {
  if (submitting.value || !content.value.trim() || !canReply.value || !requireStudent()) return;
  const current = captureWrite();
  const text = content.value.trim();
  const parentCommentId = replyingTo.value?.id;
  submitting.value = true;
  try {
    const response = await createPostComment(id.value, {
      content: text,
      ...(parentCommentId ? { parentCommentId } : {}),
    });
    if (!current()) return;
    if (![200, 201].includes(response.code))
      throw new Error(response.message || t('social.sendReplyFailed'));
    content.value = '';
    replyingTo.value = null;
    replyFocused.value = false;
    commentsRequest++;
    commentsLoading.value = false;
    comments.value = mergeComments([...comments.value, response.data]);
    totalComments.value++;
    if (post.value && response.data.status === 'approved') post.value.commentCount++;
  } catch (cause) {
    if (current() && visible)
      uni.showToast({
        title: cause instanceof Error ? cause.message : t('social.sendReplyRetry'),
        icon: 'none',
      });
  } finally {
    if (current()) submitting.value = false;
  }
}
function openReport(type: 'post' | 'comment', targetId: string) {
  if (requireStudent()) reportTarget.value = { type, id: targetId };
}
function managePost() {
  if (!post.value) return;
  const current = capture();
  const own = post.value.userId === user.userInfo?.id;
  uni.showActionSheet({
    itemList: own ? [t('social.editPost'), t('social.deletePost')] : [t('social.reportPost')],
    success: result => {
      if (!current()) return;
      if (!own) {
        openReport('post', id.value);
        return;
      }
      if (result.tapIndex === 0) {
        if (requireStudent())
          uni.navigateTo({ url: `/pages/community/editor?id=${encodeURIComponent(id.value)}` });
      } else confirmRemove('post', id.value);
    },
  });
}
function manageComment(comment: PostComment) {
  const current = capture();
  const own = comment.userId === user.userInfo?.id;
  uni.showActionSheet({
    itemList: own ? [t('social.deleteReply')] : [t('social.reportReply')],
    success: () => {
      if (current()) own ? confirmRemove('comment', comment.id) : openReport('comment', comment.id);
    },
  });
}
function confirmRemove(type: 'post' | 'comment', targetId: string) {
  const current = capture();
  uni.showModal({
    title: type === 'post' ? t('social.deletePostQuestion') : t('social.deleteReplyQuestion'),
    content: t('social.deletionPermanent'),
    confirmText: t('common.modal.delete'),
    success: async result => {
      if (!result.confirm || !current()) return;
      try {
        const response =
          type === 'post' ? await deletePost(targetId) : await deletePostComment(targetId);
        if (!current()) return;
        if (response.code !== 200) throw new Error(response.message || t('social.deleteFailed'));
        if (type === 'post') {
          leaving = true;
          uni.navigateBack({ fail: () => openCampus() });
        } else {
          await loadComments();
          if (post.value) void load();
        }
      } catch (cause) {
        if (current())
          uni.showToast({
            title: cause instanceof Error ? cause.message : t('social.deleteRetry'),
            icon: 'none',
          });
      }
    },
  });
}
async function submitReport(data: ReportRequest) {
  if (!reportTarget.value || reportSubmitting.value || !requireStudent()) return;
  const current = captureWrite();
  const target = reportTarget.value;
  reportSubmitting.value = true;
  try {
    const response =
      target.type === 'post'
        ? await reportPost(target.id, data)
        : await reportPostComment(target.id, data);
    if (!current() || target !== reportTarget.value) return;
    if (![200, 201].includes(response.code))
      throw new Error(response.message || t('social.reportFailed'));
    reportTarget.value = null;
    if (visible) uni.showToast({ title: t('social.reportSubmitted'), icon: 'success' });
  } catch (cause) {
    if (current() && visible)
      uni.showToast({
        title: cause instanceof Error ? cause.message : t('social.reportRetry'),
        icon: 'none',
      });
  } finally {
    if (current()) reportSubmitting.value = false;
  }
}
function reset() {
  epoch++;
  postRequest++;
  commentsRequest++;
  post.value = null;
  comments.value = [];
  canReply.value = false;
  content.value = '';
  replyingTo.value = null;
  reportTarget.value = null;
  loading.value = false;
  commentsLoading.value = false;
  submitting.value = false;
  reportSubmitting.value = false;
  commentsReady.value = false;
  totalPages.value = 0;
  page.value = 0;
  totalComments.value = 0;
  error.value = '';
  commentsError.value = '';
  resetLikes();
}
watch(
  () => user.sessionVersion,
  session => {
    reset();
    void nextTick(() => {
      if (active && visible && session === user.sessionVersion) void load();
    });
  },
  { flush: 'sync' }
);
onLoad(options => {
  id.value = String(options?.id || '');
});
onShow(() => {
  visible = true;
  void load();
});
onHide(() => {
  visible = false;
  epoch++;
  loading.value = false;
  commentsLoading.value = false;
});
onScopeDispose(() => {
  active = false;
  epoch++;
});
onPullDownRefresh(async () => {
  try {
    await load();
  } finally {
    uni.stopPullDownRefresh();
  }
});
onReachBottom(() => {
  if (!commentsError.value) void loadComments(true);
});
onBackPress(() => {
  if (leaving) return false;
  if (reportTarget.value) {
    void reportDialog.value?.requestClose();
    return true;
  }
  if (submitting.value || checkingLeave) return true;
  if (!content.value.trim()) return false;
  checkingLeave = true;
  const current = capture();
  void confirmDiscardChanges(true, t('social.discardReply'))
    .then(discard => {
      if (discard && current()) {
        leaving = true;
        uni.navigateBack();
      }
    })
    .finally(() => {
      checkingLeave = false;
    });
  return true;
});
</script>
<style scoped>
@import './community.css';
.post-detail {
  padding-top: 0;
}
.reply-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 28px 0 8px;
}
.reply-title {
  font-size: 18px;
  font-weight: 600;
}
.post-reply {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #e5e7eb;
}
.reply-avatar {
  width: 32px;
  padding: 0;
}
.reply-main {
  min-width: 0;
  flex: 1;
}
.reply-top,
.reply-bottom,
.reply-actions,
.reply-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.reply-name {
  justify-content: flex-start;
  padding: 0;
  color: #1f2937;
  font-weight: 600;
  overflow-wrap: anywhere;
  text-align: left;
}
.reply-menu {
  width: 44px;
  padding: 0;
  flex-shrink: 0;
}
.reply-menu image {
  width: 20px;
  height: 20px;
}
.reply-content {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 15px;
  line-height: 1.8;
}
.reply-date {
  font-size: 12px;
}
.reply-action {
  padding: 6px;
  color: #667085;
  font-size: 13px;
}
.reply-liked {
  color: #660874;
}
.post-composer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}
.reply-composer-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.post-reply-input {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  min-height: 72px;
  max-height: 180px;
  padding: 12px;
  background: #f4f4f5;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.6;
  caret-color: #660874;
}
.post-reply-input:focus-within {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
