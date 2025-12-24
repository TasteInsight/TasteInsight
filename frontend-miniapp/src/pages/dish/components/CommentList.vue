<template>
  <view class="mt-2">
    <!-- 评论容器 - 只显示最多4个 -->
    <view v-if="displayComments.length > 0" class="ml-4 mt-3">
      <view class="bg-gray-100 rounded-lg p-3 border border-gray-100">
        <!-- 评论列表 -->
        <view class="flex flex-col gap-2">
          <view
            v-for="comment in displayComments"
            :key="comment.id"
          >
            <view class="text-sm text-gray-700">
              <text class="text-purple-800 font-normal">{{ comment.userNickname }}</text>
              <!-- 回复目标显示 -->
              <template v-if="comment.parentComment && !comment.parentComment.deleted">
                <text class="text-gray-500 text-sm"> 回复 </text>
                <text class="text-purple-800 font-normal">@{{ comment.parentComment.userNickname }}</text>
              </template>
              <text v-else-if="comment.parentComment?.deleted" class="text-gray-400 text-sm"> 回复的评论已删除</text>
              <text class="text-gray-700">:</text>
              {{ comment.content }}
            </view>
          </view>
        </view>

        <!-- 查看全部回复按钮 -->
        <view class="pt-1 mt-1">
          <button
            class="view-all-replies-btn text-purple-800 text-sm font-medium bg-transparent p-0 text-left w-full"
            @tap="emit('viewAllComments')"
          >
            共{{ totalComments }}条回复 ...
          </button>
        </view>
      </view>
    </view>
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
.view-all-replies-btn::after {
  border: none;
}
</style>
