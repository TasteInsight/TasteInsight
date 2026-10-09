<template>
  <view v-if="displayComments.length > 0" class="comment-preview">
    <view class="comment-preview-list">
      <view v-for="comment in displayComments" :key="comment.id" class="discussion-body">
        <text class="discussion-author">{{ comment.userNickname }}</text>
        <template v-if="comment.parentComment && !comment.parentComment.deleted">
          <text class="discussion-meta"> 回复 </text>
          <text class="discussion-author">@{{ comment.parentComment.userNickname }}</text>
        </template>
        <text v-else-if="comment.parentComment?.deleted" class="discussion-meta">
          回复的评论已删除</text
        >
        <text>：</text><text>{{ comment.content }}</text>
      </view>
    </view>
    <button class="discussion-action view-all-replies-btn" @tap.stop="emit('viewAllComments')">
      查看全部 {{ totalComments }} 条回复
    </button>
  </view>
</template>

<script setup lang="ts">
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
</style>
