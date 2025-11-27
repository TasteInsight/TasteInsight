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
            <text class="username">{{ comment.userNickname }}:</text>
            {{ comment.content }}
          </view>
        </view>

        <!-- 查看全部回复按钮 -->
        <view class="view-all-replies-container">
          <button
            class="view-all-replies-btn"
            @tap="emit('viewAllComments')"
          >
            共{{ totalComments }}条回复 >
          </button>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getCommentsByReview } from '@/api/modules/comment';
import type { Comment } from '@/types/api';
import dayjs from 'dayjs';

interface Props {
  reviewId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'commentAdded'): void;
  (e: 'viewAllComments'): void;
}>();

const comments = ref<Comment[]>([]);
const loading = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);
const pageSize = 5;
const totalComments = ref(0);

// 只显示最多4个评论
const displayComments = computed(() => {
  return comments.value.slice(0, 4);
});

onMounted(() => {
  fetchComments();
});

const fetchComments = async () => {
  if (loading.value) return;

  loading.value = true;

  try {
    const response = await getCommentsByReview(props.reviewId, {
      page: currentPage.value,
      pageSize,
    });

    if (response.code === 200 && response.data) {
      const newComments = response.data.items || [];

      if (currentPage.value === 1) {
        comments.value = newComments;
        totalComments.value = response.data.meta?.total || 0;
      } else {
        comments.value = [...comments.value, ...newComments];
      }

      hasMore.value = newComments.length === pageSize;
    }
  } catch (err) {
    console.error('获取评论失败:', err);
  } finally {
    loading.value = false;
  }
};

const loadMore = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++;
    fetchComments();
  }
};


const formatDate = (dateString: string) => {
  return dayjs(dateString).format('MM-DD HH:mm');
};
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

/* 用户名样式 - 紫色 */
.username {
  font-size: 14px;
  font-weight: normal; /* 不加粗 */
  color: #7c3aed; /* 紫色 */
}

/* 查看全部回复按钮容器 */
.view-all-replies-container {
  padding-top: 4px;
  margin-top: 4px;
}

/* 查看全部回复按钮 */
.view-all-replies-btn {
  color: #7c3aed; /* 紫色 */
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  width: 100%;
  cursor: pointer;
}

.view-all-replies-btn:hover {
  color: #6d28d9;
}

/* 添加评论按钮 */
.add-comment-btn {
  color: #7c3aed; /* 紫色 */
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.add-comment-btn:hover {
  color: #6d28d9;
}
</style>
