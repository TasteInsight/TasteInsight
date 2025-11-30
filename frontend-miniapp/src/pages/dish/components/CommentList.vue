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
              <text class="text-gray-400 mr-1">{{ getFloor(comment.id) }}楼</text>
              <text class="text-purple-800 font-normal">{{ comment.userNickname }}:</text>
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
import { computed, onMounted } from 'vue';
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

// 只显示最多4个评论
const displayComments = computed(() => {
  return props.commentsData?.items.slice(0, 4) || [];
});

// 楼层映射表：根据评论创建时间排序后生成楼层号
const floorMap = computed(() => {
  const map = new Map<string, number>();
  const allComments = props.commentsData?.items || [];
  // 复制数组并按时间升序排序（最早的是1楼）
  const sorted = [...allComments].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  sorted.forEach((comment, index) => {
    map.set(comment.id, index + 1);
  });
  return map;
});

// 获取评论的楼层号
const getFloor = (commentId: string): number => {
  return floorMap.value.get(commentId) || 0;
};

const totalComments = computed(() => {
  return props.commentsData?.total || 0;
});

onMounted(() => {
  props.fetchComments(props.reviewId);
});
</script>

<style scoped>
.view-all-replies-btn::after {
  border: none;
}
</style>
