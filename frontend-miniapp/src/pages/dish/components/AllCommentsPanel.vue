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
    <view class="all-comments-container">
      <!-- 头部 -->
      <view class="panel-header">
        <h2 class="panel-title">全部回复</h2>
        <button
          class="close-btn"
          @tap="handleClose"
        >
          <text>✕</text>
        </button>
      </view>

      <!-- 评论列表 -->
      <view class="comments-content">
        <view v-if="loading && comments.length === 0" class="loading-state">
          <text class="text-gray-500">加载中...</text>
        </view>

        <view v-else-if="comments.length === 0" class="empty-state">
          <text class="text-gray-500">暂无评论</text>
        </view>

        <view v-else class="comments-list">
          <view
            v-for="(comment, index) in comments"
            :key="comment.id"
            class="comment-item"
            @tap="selectCommentForReply(comment)"
            @longpress="(e: any) => handleLongPress(e, comment)"
          >
            <!-- 评论内容区域 -->
            <view class="comment-content-area">
              <!-- 用户头像和信息 -->
              <view class="comment-header">
                <img
                  :src="comment.userAvatar || '/default-avatar.png'"
                  class="comment-avatar"
                  alt="用户头像"
                />
                <view class="comment-info">
                  <text class="text-ts-purple font-semibold text-sm block mb-0.5">{{ comment.userNickname }}</text>
                  <text class="comment-date">{{ formatDate(comment.createdAt) }}</text>
                </view>
              </view>

              <!-- 回复目标显示 -->
              <view v-if="comment.parentComment && !comment.parentComment.deleted" class="reply-target">
                <text class="text-gray-500 text-xs">回复</text>
                <text class="text-ts-purple text-xs font-medium ml-1">@{{ comment.parentComment.userNickname }}</text>
              </view>
              <view v-else-if="comment.parentComment?.deleted" class="reply-target">
                <text class="text-gray-400 text-xs">回复的评论已删除</text>
              </view>

              <!-- 评论内容 -->
              <view class="comment-content">
                {{ comment.content }}
              </view>
            </view>

            <!-- 分隔线 -->
            <view v-if="index < comments.length - 1" class="comment-divider"></view>
          </view>

          <!-- 加载更多 -->
          <view v-if="hasMore && !loading" class="load-more">
            <button
              class="load-more-btn text-gray-500 after:border-none"
              @tap="loadMoreComments"
            >
              加载更多评论
            </button>
          </view>
        </view>
      </view>

      <!-- 底部回复输入框 -->
      <view class="bottom-reply-input">
        <view v-if="replyingTo" class="replying-indicator">
          <text class="text-ts-purple text-xs font-medium">回复 @{{ replyingTo.userNickname }}</text>
          <button class="cancel-reply-btn" @tap="cancelReply">
            <text>✕</text>
          </button>
        </view>

        <view class="input-row">
          <input
            v-model="replyContent"
            class="reply-input"
            :placeholder="replyingTo ? `回复 @${replyingTo.userNickname}...` : '写下你的回复...'"
            @confirm="submitReply"
          />
          <button
            class="send-btn"
            :class="{ 'send-btn-active': canSendReply }"
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

    if (response.code === 200 && response.data) {
      uni.showToast({
        title: '回复成功',
        icon: 'success',
      });

      // 构建新评论对象，包含 parentComment 信息
      const newComment: Comment = {
        ...response.data,
        // 如果后端没有返回 parentComment，手动构建
        parentComment: replyingTo.value ? {
          id: replyingTo.value.id,
          userId: replyingTo.value.userId,
          userNickname: replyingTo.value.userNickname,
          deleted: false,
        } : response.data.parentComment,
      };

      // 将新评论添加到列表开头
      comments.value = [newComment, ...comments.value];

      replyContent.value = '';
      replyingTo.value = null;

      emit('commentAdded');
    } else if (response.code === 200) {
      // 如果没有返回 data，则刷新列表
      uni.showToast({
        title: '回复成功',
        icon: 'success',
      });
      replyContent.value = '';
      replyingTo.value = null;
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
        // 乐观更新：直接从列表中移除
        comments.value = comments.value.filter(c => c.id !== commentId);
      }
    }
  });
};

const formatDate = (dateString: string) => {
  return dayjs(dateString).format('MM-DD HH:mm');
};
</script>

<style scoped>
/* 面板容器 */
.all-comments-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 头部 */
.panel-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  flex-shrink: 0;
  position: relative;
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 18px;
  border-radius: 50%;
  background: transparent;
  border: none;
}

.close-btn:hover {
  background-color: #f3f4f6;
}

/* 内容区域 */
.comments-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #6b7280;
}

/* 评论列表 */
.comments-list {
  padding: 16px 0;
}

.comment-item {
  margin-bottom: 0;
}

.comment-content-area {
  padding: 12px 0;
}

/* 评论头部区域 */
.comment-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

/* 用户头像 */
.comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 12px;
  border: 1px solid #e5e7eb;
}

/* 评论信息 */
.comment-info {
  flex: 1;
}

.comment-date {
  font-size: 12px;
  color: #9ca3af;
}

/* 回复按钮 */
.reply-btn {
  font-size: 12px;
  color: #7c3aed;
  background: transparent;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
}

.reply-btn:hover {
  background-color: #f3f4f6;
}

/* 评论内容 */
.comment-content {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  margin-left: 44px; /* 头像宽度 + 间距 */
}

/* 分隔线 */
.comment-divider {
  height: 1px;
  background-color: #e5e7eb;
  margin: 12px 0;
}

.reply-btn:hover {
  background-color: #f3f4f6;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 16px 0;
}

.load-more-btn {
  font-size: 14px;
  background: transparent;
  border: none;
}

/* 底部回复输入框 */
.bottom-reply-input {
  border-top: 1px solid #e5e5e5;
  background-color: #ffffff;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  flex-shrink: 0;
}

/* 回复对象指示器 */
.replying-indicator {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 4px 8px;
  background-color: #f3f4f6;
  border-radius: 8px;
  margin-bottom: 8px;
  gap: 8px;
}

.cancel-reply-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 14px;
  background: transparent;
  border: none;
  border-radius: 50%;
}

.cancel-reply-btn:hover {
  background-color: #e5e7eb;
}

/* 输入行 */
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reply-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  font-size: 14px;
  background-color: #f9fafb;
}

.reply-input:focus {
  outline: none;
  border-color: #a855f7;
  background-color: #ffffff;
}

.send-btn {
  padding: 0 16px;
  height: 34px; /* 与输入框高度一致 */
  line-height: 34px;
  background: #d1d5db; /* 默认灰色背景 */
  color: #9ca3af; /* 默认灰色文字 */
  border: none;
  border-radius: 17px; /* 与输入框圆角一致 */
  font-size: 14px;
  font-weight: 500;
  min-width: 60px;
  transition: all 0.2s ease;
}

.send-btn-active {
  background: linear-gradient(135deg, #7e22ce 0%, #9333ea 100%); /* 更深的紫色背景 */
  color: white; /* 白色文字 */
}

.send-btn-active:hover {
  background: linear-gradient(135deg, #6b21a8, #7e22ce);
}
</style>
