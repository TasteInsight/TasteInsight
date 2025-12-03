import { ref } from 'vue';
import { getCommentsByReview, createComment, deleteComment } from '@/api/modules/comment';
import type { Comment, CommentCreateRequest } from '@/types/api';

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
      if (response.code === 200) {
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
