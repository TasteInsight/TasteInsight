<template>
  <view v-if="displayComments.length > 0" class="comment-preview">
    <view class="comment-preview-list">
      <view v-for="comment in displayComments" :key="comment.id" class="discussion-body">
        <!-- #ifndef MP-WEIXIN -->
        <text
          class="discussion-author preview-author"
          role="link"
          tabindex="0"
          @tap.stop="openAuthor(comment.userId)"
          @keydown.enter.stop.prevent="openAuthor(comment.userId)"
          >{{ comment.userNickname }}</text
        >
        <!-- #endif -->
        <!-- #ifdef MP-WEIXIN -->
        <text class="discussion-author">{{ comment.userNickname }}</text>
        <!-- #endif -->
        <template v-if="comment.parentComment && !comment.parentComment.deleted">
          <text class="discussion-meta"> {{ t('food.reply') }} </text>
          <text class="discussion-author">@{{ comment.parentComment.userNickname }}</text>
        </template>
        <text v-else-if="comment.parentComment?.deleted" class="discussion-meta">
          {{ t('food.originalCommentDeleted') }}</text
        >
        <text>{{ t('food.discussionSeparator') }}</text
        ><text>{{ comment.content }}</text>
      </view>
    </view>
    <button class="discussion-action view-all-replies-btn" @tap.stop="emit('viewAllComments')">
      {{ t('food.viewAllReplies', { count: totalComments }) }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { computed, onMounted, watch } from 'vue';
import type { Comment } from '@/types/api';

interface Props {
  reviewId: string;
  commentsData?: {
    items: Comment[];
    total: number;
    loading: boolean;
  };
  fetchComments: (reviewId: string) => Promise<void>;
}

const props = defineProps<Props>();
// #ifndef MP-WEIXIN
const openAuthor = (id: string) =>
  uni.navigateTo({ url: `/pages/profile/public?id=${encodeURIComponent(id)}` });
// #endif
const emit = defineEmits<{
  (e: 'commentAdded'): void;
  (e: 'viewAllComments'): void;
}>();

// 只显示最多4个评论（最新的评论）
const displayComments = computed(() => {
  return props.commentsData?.items.slice(0, 4) || [];
});

const totalComments = computed(() => {
  return props.commentsData?.total || 0;
});

onMounted(() => {
  props.fetchComments(props.reviewId);
});

watch(
  () => props.reviewId,
  (nextId, prevId) => {
    if (!nextId || nextId === prevId) return;
    props.fetchComments(nextId);
  }
);
</script>

<style scoped>
@import './discussion.css';
.comment-preview {
  margin-top: 8px;
  padding: 8px 12px 0;
  background: #f4f4f5;
  border-radius: 10px;
  overflow-wrap: anywhere;
}
.comment-preview-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.view-all-replies-btn {
  justify-content: flex-start;
  padding: 0;
  text-align: left;
  color: #660874;
}
.preview-author:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
