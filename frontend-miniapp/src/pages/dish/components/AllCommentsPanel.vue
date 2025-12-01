<template>
  <!-- 全部评论面板 -->
  <page-container
    :show="isVisible"
    position="bottom"
    :round="true"
    :overlay="true"
    custom-style="height: 85vh; background-color: #fff;"
    @clickoverlay="handleClose"
    @afterleave="handleClose"
  >
    <view class="w-full h-full flex flex-col">
      <!-- 头部 -->
      <view class="flex justify-center items-center py-4 px-5 border-b border-gray-200 shrink-0 relative">
        <h2 class="text-lg font-semibold text-gray-800">全部回复</h2>
        <button
          class="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-500 text-lg rounded-full bg-transparent border-none"
          @tap="handleClose"
        >
          <text>✕</text>
        </button>
      </view>

      <!-- 评论列表 -->
      <view class="flex-1 overflow-y-auto px-5">
        <view v-if="loading && comments.length === 0" class="flex justify-center items-center h-48 text-gray-500">
          <text>加载中...</text>
        </view>

        <view v-else-if="comments.length === 0" class="flex justify-center items-center h-48 text-gray-500">
          <text>暂无评论</text>
        </view>

        <view v-else class="py-4">
          <view
            v-for="(comment, index) in comments"
            :key="comment.id"
            @tap="selectCommentForReply(comment)"
            @longpress="(e: any) => handleLongPress(e, comment)"
          >
            <!-- 评论内容区域 -->
            <view class="py-3">
              <!-- 用户头像和信息 -->
              <view class="flex mb-2">
                <img
                  :src="comment.userAvatar || '/default-avatar.png'"
                  class="w-8 h-8 rounded-full mr-3 border border-gray-200 shrink-0"
                  alt="用户头像"
                />
                <view class="flex-1">
                  <!-- 第一行：用户名和回复目标 -->
                  <view class="flex items-center mb-1">
                    <text class="text-ts-purple font-semibold text-sm">{{ comment.userNickname }}</text>
                    <!-- 回复目标显示 -->
                    <template v-if="comment.parentComment && !comment.parentComment.deleted">
                      <text class="text-gray-500 text-sm ml-2">回复</text>
                      <text class="text-ts-purple text-sm font-semibold ml-1">@{{ comment.parentComment.userNickname }}</text>
                    </template>
                    <text v-else-if="comment.parentComment?.deleted" class="text-gray-400 text-sm ml-2">回复的评论已删除</text>
                  </view>
                  <!-- 第二行：评论内容 -->
                  <view class="text-sm text-gray-700 leading-relaxed mb-1">
                    {{ comment.content }}
                  </view>
                  <!-- 第三行：楼层和日期 -->
                  <view class="flex items-center">
                    <text class="text-xs text-gray-400 mr-2">{{ comment.floor ?? '--' }}楼</text>
                    <text class="text-xs text-gray-400">{{ formatDate(comment.createdAt) }}</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- 分隔线 -->
            <view v-if="index < comments.length - 1" class="h-px bg-gray-200 my-3"></view>
          </view>

          <!-- 加载更多 -->
          <view v-if="hasMore && !loading" class="text-center py-4">
            <button
              class="text-sm text-gray-500 bg-transparent border-none after:border-none"
              @tap="loadMoreComments"
            >
              加载更多评论
            </button>
          </view>
        </view>
      </view>

      <!-- 底部回复输入框 -->
      <view class="border-t border-gray-200 bg-white px-4 pt-3 pb-safe shrink-0">
        <view v-if="replyingTo" class="flex items-center mb-2">
          <text class="text-ts-purple text-xs font-medium flex-1">回复 @{{ replyingTo.userNickname }}</text>
          <button class="w-5 h-5 flex items-center justify-center text-gray-500 text-sm bg-transparent border-none rounded-full after:border-none" @tap="cancelReply">
            <text>✕</text>
          </button>
        </view>

        <view class="flex items-center gap-2">
          <input
            v-model="replyContent"
            class="flex-1 py-2 px-3 border border-gray-300 rounded-full text-sm bg-gray-50 focus:border-purple-400 focus:bg-white"
            :placeholder="replyingTo ? `回复 @${replyingTo.userNickname}...` : '写下你的回复...'"
            @confirm="submitReply"
          />
          <button
            class="px-4 py-2 border-none rounded-full text-sm font-medium min-w-[60px] transition-all duration-200 after:border-none"
            :class="canSendReply ? 'bg-gradient-to-br from-purple-700 to-purple-600 text-white' : 'bg-gray-300 text-gray-400'"
            :disabled="!canSendReply"
            @tap="submitReply"
          >
            发送
          </button>
        </view>
      </view>

      <!-- 长按菜单 -->
      <LongPressMenu
        :visible="menuVisible"
        :can-delete="canDeleteCurrent"
        @close="closeMenu"
        @delete="confirmDelete"
        @report="handleReportFromMenu"
      />

      <!-- 举报弹窗 (嵌套在 page-container 内部) -->
      <ReportDialog
        v-if="isReportVisible"
        @close="closeReportModal"
        @submit="submitReport"
      />
    </view>
  </page-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { getCommentsByReview, createComment } from '@/api/modules/comment';
import type { Comment } from '@/types/api';
import dayjs from 'dayjs';
import { useUserStore } from '@/store/modules/use-user-store';
import ReportDialog from './ReportDialog.vue';
import LongPressMenu from './LongPressMenu.vue';
import { useReport } from '@/pages/dish/composables/use-report';

const userStore = useUserStore();

// 长按菜单相关状态
const menuVisible = ref(false);
const currentCommentId = ref('');
const currentComment = ref<Comment | null>(null);

// 计算当前评论是否可删除
const canDeleteCurrent = computed(() => {
  if (!currentComment.value) return false;
  return currentComment.value.userId === userStore.userInfo?.id;
});

// 长按处理
const handleLongPress = (_e: any, comment: Comment) => {
  currentCommentId.value = comment.id;
  currentComment.value = comment;
  menuVisible.value = true;
};

// 关闭菜单
const closeMenu = () => {
  menuVisible.value = false;
  currentCommentId.value = '';
  currentComment.value = null;
};

// 确认删除
const confirmDelete = () => {
  if (!currentCommentId.value) return;
  handleDelete(currentCommentId.value);
  closeMenu();
};

// 从菜单打开举报
const handleReportFromMenu = () => {
  const commentId = currentCommentId.value;
  closeMenu();
  openReportModal('comment', commentId);
};
const {
  isReportVisible,
  openReportModal,
  closeReportModal,
  submitReport
} = useReport();

interface Props {
  reviewId: string;
  isVisible: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'commentAdded'): void;
  (e: 'delete', commentId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const comments = ref<Comment[]>([]);
const loading = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);
const pageSize = 10;
const replyContent = ref('');
const replyingTo = ref<Comment | null>(null);

// 计算属性：判断是否可以发送
const canSendReply = computed(() => {
  return replyContent.value.trim().length > 0;
});

// 监听面板显示状态
watch(() => props.isVisible, (visible: boolean) => {
  if (visible) {
    currentPage.value = 1;
    fetchComments();
  } else {
    // 重置状态
    replyContent.value = '';
    replyingTo.value = null;
  }
});

onMounted(() => {
  if (props.isVisible) {
    fetchComments();
  }
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

const loadMoreComments = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++;
    fetchComments();
  }
};

const selectCommentForReply = (comment: Comment) => {
  replyingTo.value = comment;
};

const cancelReply = () => {
  replyingTo.value = null;
};

const submitReply = async () => {
  if (!replyContent.value.trim()) {
    uni.showToast({
      title: '请输入回复内容',
      icon: 'none',
    });
    return;
  }

  try {
    const requestData: { reviewId: string; content: string; parentCommentId?: string } = {
      reviewId: props.reviewId,
      content: replyContent.value.trim(),
    };
    
    // 如果是回复某条评论，添加 parentCommentId
    if (replyingTo.value) {
      requestData.parentCommentId = replyingTo.value.id;
    }
    
    const response = await createComment(requestData);

    if (response.code === 200) {
      uni.showToast({
        title: '回复成功',
        icon: 'success',
      });

      replyContent.value = '';
      replyingTo.value = null;
      
      // 刷新评论列表以获取正确的楼层号
      currentPage.value = 1;
      await fetchComments();

      emit('commentAdded');
    } else {
      uni.showToast({
        title: response.message || '回复失败',
        icon: 'none',
      });
    }
  } catch (err) {
    console.error('提交回复失败:', err);
    uni.showToast({
      title: '网络错误，请稍后重试',
      icon: 'none',
    });
  }
};

const handleClose = () => {
  emit('close');
};

const handleDelete = (commentId: string) => {
  uni.showModal({
    title: '提示',
    content: '确定要删除这条评论吗？',
    success: (res) => {
      if (res.confirm) {
        emit('delete', commentId);
        // 刷新评论列表以获取正确的楼层号
        currentPage.value = 1;
        fetchComments();
      }
    }
  });
};

const formatDate = (dateString: string) => {
  return dayjs(dateString).format('MM-DD HH:mm');
};
</script>

<style scoped>
/* 底部安全区域 padding */
.pb-safe {
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}

/* 移除小程序按钮默认边框 */
button::after {
  border: none;
}
</style>
