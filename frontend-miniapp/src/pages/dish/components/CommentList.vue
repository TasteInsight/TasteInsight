<template>
  <view class="comment-list">
    <!-- 评论容器 - 只显示最多4个 -->
    <view v-if="displayComments.length > 0" class="ml-4 mt-3">
      <view class="comments-container">
        <!-- 评论列表 -->
        <view
          v-for="comment in displayComments"
          :key="comment.id"
          class="comment-item"
        >
          <view class="text-sm text-gray-700">
            <text class="text-gray-400 mr-1">{{ getFloor(comment.id) }}楼</text>
            <text class="text-purple-800 font-normal">{{ comment.userNickname }}:</text>
            {{ comment.content }}
          </view>
        </view>

        <!-- 查看全部回复按钮 -->
        <view class="view-all-replies-container">
          <button
            class="view-all-replies-btn text-purple-800 text-sm font-medium bg-transparent p-0 text-left w-full cursor-pointer after:border-none"
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
.comment-list {
  margin-top: 8px;
}

/* 评论容器 - 大框 */
.comments-container {
  background-color: #f0f0f0; /* 统一灰色 */
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #f0f0f0; /* 与背景色相同 */
}

/* 单个评论项 */
.comment-item {
  margin-bottom: 8px;
}

.comment-item:last-child {
  margin-bottom: 12px; /* 最后一个评论项下面多一点间距 */
}

/* 查看全部回复按钮容器 */
.view-all-replies-container {
  padding-top: 4px;
  margin-top: 4px;
}

/* 查看全部回复按钮 */
.view-all-replies-btn::after {
  border: none;
}

.view-all-replies-btn:hover {
  color: #6d28d9;
}

/* 添加评论按钮 */
.add-comment-btn::after {
  border: none;
}
</style>
