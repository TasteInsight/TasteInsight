import { ref, computed} from 'vue';
import { getCommentsByReview, createComment, deleteComment } from '@/api/modules/comment';
import type { Comment, CommentCreateRequest } from '@/types/api';

/**
 * 评论状态管理（用于菜品详情页简略显示）
 */
export function useComment() {
  // --- 评论状态 (按 reviewId 存储) ---
  const reviewComments = ref<Record<string, { 
    items: Comment[], 
    total: number, 
    loading: boolean 
  }>>({});

  /**
   * 获取某条评价的评论
   */
  const fetchComments = async (reviewId: string) => {
    // 如果正在加载，则跳过
    if (reviewComments.value[reviewId]?.loading) return;

    // 初始化状态
    if (!reviewComments.value[reviewId]) {
      reviewComments.value[reviewId] = { items: [], total: 0, loading: true };
    } else {
      reviewComments.value[reviewId].loading = true;
    }

    try {
      // 列表页只展示前5条
      const res = await getCommentsByReview(reviewId, { page: 1, pageSize: 5 });
      if (res.code === 200 && res.data) {
        reviewComments.value[reviewId] = {
          items: res.data.items || [],
          total: res.data.meta?.total || 0,
          loading: false
        };
      }
    } catch (e) {
      console.error('获取评论失败', e);
      reviewComments.value[reviewId].loading = false;
    }
  };

  /**
   * 提交评论
   */
  const submitComment = async (payload: CommentCreateRequest) => {
    try {
      const response = await createComment(payload);
      if (response.code === 200 || response.code === 201) {
        return response.data;
      } else {
        throw new Error(response.message || '提交失败');
      }
    } catch (err: any) {
      console.error('提交评论失败:', err);
      throw err;
    }
  };

  /**
   * 删除评论
   */
  const removeComment = async (commentId: string, reviewId: string) => {
    try {
      const res = await deleteComment(commentId);
      if (res.code === 200) {
        // 从缓存中移除
        if (reviewComments.value[reviewId]) {
          const comments = reviewComments.value[reviewId];
          comments.items = comments.items.filter(c => c.id !== commentId);
          comments.total--;
        }
        return true;
      } else {
        throw new Error(res.message || '删除失败');
      }
    } catch (err) {
      console.error('删除评论失败', err);
      throw err;
    }
  };

  return {
    reviewComments,
    fetchComments,
    submitComment,
    removeComment
  };
}

/**
 * 全部评论面板逻辑
 */
export function useCommentPanel(reviewId: () => string, onCommentAdded?: () => void) {
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

  /**
   * 获取评论列表
   */
  const fetchPanelComments = async () => {
    if (loading.value) return;

    loading.value = true;

    try {
      const response = await getCommentsByReview(reviewId(), {
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

  /**
   * 加载更多评论
   */
  const loadMoreComments = () => {
    if (hasMore.value && !loading.value) {
      currentPage.value++;
      fetchPanelComments();
    }
  };

  /**
   * 选择评论进行回复
   */
  const selectCommentForReply = (comment: Comment) => {
    replyingTo.value = comment;
  };

  /**
   * 取消回复
   */
  const cancelReply = () => {
    replyingTo.value = null;
  };

  /**
   * 提交回复
   */
  const submitReply = async () => {
    if (!replyContent.value.trim()) {
      uni.showToast({
        title: '请输入回复内容',
        icon: 'none',
      });
      return;
    }

    try {
      const requestData: CommentCreateRequest = {
        reviewId: reviewId(),
        content: replyContent.value.trim(),
      };
      
      // 如果是回复某条评论，添加 parentCommentId
      if (replyingTo.value) {
        requestData.parentCommentId = replyingTo.value.id;
      }
      
      const response = await createComment(requestData);

      if (response.code === 200 || response.code === 201) {
        uni.showToast({
          title: '回复成功',
          icon: 'success',
        });

        replyContent.value = '';
        replyingTo.value = null;
        
        // 刷新评论列表以获取正确的楼层号
        currentPage.value = 1;
        await fetchPanelComments();

        onCommentAdded?.();
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

  /**
   * 重置面板状态
   */
  const resetPanel = () => {
    comments.value = [];
    loading.value = false;
    hasMore.value = false;
    currentPage.value = 1;
    replyContent.value = '';
    replyingTo.value = null;
  };

  /**
   * 刷新评论列表
   */
  const refreshComments = () => {
    currentPage.value = 1;
    fetchPanelComments();
  };

  return {
    comments,
    loading,
    hasMore,
    replyContent,
    replyingTo,
    canSendReply,
    fetchPanelComments,
    loadMoreComments,
    selectCommentForReply,
    cancelReply,
    submitReply,
    resetPanel,
    refreshComments
  };
}
