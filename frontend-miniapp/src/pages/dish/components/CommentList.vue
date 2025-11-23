<template>
  <view class="comment-list">
    <!-- 评论列表 -->
    <view v-if="comments.length > 0" class="ml-4 mt-3">
      <view 
        v-for="comment in comments" 
        :key="comment.id"
        class="border-l-2 border-purple-200 pl-4 py-2 mb-2"
      >
        <view class="flex items-start bg-purple-50 rounded-lg p-3">
          <view class="flex-1">
            <view class="flex items-center">
              <text class="text-xs font-semibold text-purple-700">{{ comment.userNickname }}</text>
              <text class="text-xs text-gray-400 ml-2">{{ formatDate(comment.createdAt) }}</text>
            </view>
            <view class="text-sm text-gray-700 mt-1 leading-relaxed">{{ comment.content }}</view>
          </view>
        </view>
      </view>

      <!-- 加载更多评论 -->
      <view v-if="hasMore" class="text-center py-2">
        <button 
          class="text-purple-600 text-xs font-medium hover:text-purple-700"
          @click="loadMore"
        >
          查看更多评论 ↓
        </button>
      </view>
    </view>

    <!-- 添加评论按钮 -->
    <view class="mt-3">
      <button 
        class="text-purple-600 text-sm font-medium hover:text-purple-700 bg-purple-50 px-4 py-2 rounded-full"
        @click="showCommentInput"
      >
         添加评论
      </button>
    </view>

    <!-- 评论输入框 -->
    <view v-if="isInputVisible" class="mt-3 flex items-center gap-2 bg-purple-50 p-3 rounded-xl">
      <input 
        v-model="commentContent"
        class="flex-1 px-4 py-2 border-2 border-purple-200 rounded-lg text-sm focus:border-purple-400 transition-colors"
        placeholder="写下你的评论..."
        @confirm="submitComment"
      />
      <button 
        class="px-5 py-2 bg-purple-600 text-ts-purple text-sm rounded-lg hover:bg-purple-700 transition-colors"
        @click="submitComment"
      >
        发送
      </button>
      <button 
        class="px-4 py-2 bg-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-300 transition-colors"
        @click="hideCommentInput"
      >
        取消
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCommentsByReview, createComment } from '@/api/modules/comment';
import type { Comment } from '@/types/api';
import dayjs from 'dayjs';

interface Props {
  reviewId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'commentAdded'): void;
}>();

const comments = ref<Comment[]>([]);
const loading = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);
const pageSize = 5;

const isInputVisible = ref(false);
const commentContent = ref('');

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

const showCommentInput = () => {
  isInputVisible.value = true;
};

const hideCommentInput = () => {
  isInputVisible.value = false;
  commentContent.value = '';
};

const submitComment = async () => {
  if (!commentContent.value.trim()) {
    uni.showToast({
      title: '请输入评论内容',
      icon: 'none',
    });
    return;
  }

  try {
    const response = await createComment({
      reviewId: props.reviewId,
      content: commentContent.value.trim(),
    });

    if (response.code === 200) {
      uni.showToast({
        title: '评论成功',
        icon: 'success',
      });
      
      hideCommentInput();
      currentPage.value = 1;
      await fetchComments();
      emit('commentAdded');
    } else {
      uni.showToast({
        title: response.message || '评论失败',
        icon: 'none',
      });
    }
  } catch (err) {
    console.error('提交评论失败:', err);
    uni.showToast({
      title: '网络错误，请稍后重试',
      icon: 'none',
    });
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
</style>
