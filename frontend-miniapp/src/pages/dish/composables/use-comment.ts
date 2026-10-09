import { ref, computed, watch, getCurrentScope, onScopeDispose } from 'vue';
import { getCommentsByReview, createComment, deleteComment } from '@/api/modules/comment';
import type { Comment, CommentCreateRequest } from '@/types/api';
import { useUserStore } from '@/store/modules/use-user-store';

/**
 * 评论状态管理（用于菜品详情页简略显示）
 */
export function useComment() {
  const userStore = useUserStore();
  let disposed = false;
  const queryVersions = new Map<string, number>();
  // --- 评论状态 (按 reviewId 存储) ---
  const reviewComments = ref<
    Record<
      string,
      {
        items: Comment[];
        total: number;
        loading: boolean;
      }
    >
  >({});

  /**
   * 获取某条评价的评论
   */
  const fetchComments = async (reviewId: string, refresh = false): Promise<void> => {
    if (disposed || (reviewComments.value[reviewId]?.loading && !refresh)) return;
    const session = userStore.sessionVersion;
    const query = (queryVersions.get(reviewId) || 0) + 1;
    queryVersions.set(reviewId, query);
    const isCurrent = () =>
      !disposed && session === userStore.sessionVersion && queryVersions.get(reviewId) === query;

    // 初始化状态
    if (!reviewComments.value[reviewId]) {
      reviewComments.value[reviewId] = { items: [], total: 0, loading: true };
    } else {
      reviewComments.value[reviewId].loading = true;
    }

    try {
      // 列表页只展示前5条
      const res = await getCommentsByReview(reviewId, { page: 1, pageSize: 5 });
      if (!isCurrent()) return;
      if (res.code === 200 && res.data) {
        reviewComments.value[reviewId] = {
          items: res.data.items || [],
          total: res.data.meta?.total || 0,
          loading: false,
        };
      }
    } catch (e) {
      if (!isCurrent()) return;
      console.error('获取评论失败', e);
    } finally {
      if (isCurrent()) reviewComments.value[reviewId].loading = false;
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

  watch(
    () => userStore.sessionVersion,
    () => {
      reviewComments.value = {};
      queryVersions.clear();
    },
    { flush: 'sync' }
  );
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
    });

  return {
    reviewComments,
    fetchComments,
    submitComment,
    removeComment,
  };
}

/**
 * 全部评论面板逻辑
 */
export function useCommentPanel(reviewId: () => string, onCommentAdded?: () => void) {
  const userStore = useUserStore();
  let disposed = false;
  let panelVersion = 0;
  let queryVersion = 0;
  const captureOperation = () => {
    const panel = panelVersion;
    const session = userStore.sessionVersion;
    const id = reviewId();
    return () =>
      !disposed &&
      panel === panelVersion &&
      session === userStore.sessionVersion &&
      id === reviewId();
  };
  const comments = ref<Comment[]>([]);
  const initialized = ref(false);
  const loading = ref(false);
  const error = ref('');
  const submitting = ref(false);
  const deletingId = ref('');
  const hasMore = ref(false);
  const currentPage = ref(1);
  let failedPage: number | null = null;
  const pageSize = 10;
  const replyContent = ref('');
  const replyingTo = ref<Comment | null>(null);
  const canReply = ref(true);
  const unpagedReplies = new Map<string, Comment>();
  const mergeComments = (items: Comment[]): Comment[] => {
    const byId = new Map(items.map(comment => [comment.id, comment]));
    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.id.localeCompare(b.id)
    );
  };

  // 计算属性：判断是否可以发送
  const canSendReply = computed(() => {
    return canReply.value && replyContent.value.trim().length > 0 && !submitting.value;
  });

  /**
   * 获取评论列表
   */
  const fetchPanelPage = async (page: number): Promise<boolean> => {
    if (disposed || !reviewId()) return false;
    const isCurrentPanel = captureOperation();
    const query = ++queryVersion;
    const isCurrent = () => isCurrentPanel() && query === queryVersion;
    loading.value = true;
    error.value = '';
    failedPage = null;

    try {
      const response = await getCommentsByReview(reviewId(), {
        page,
        pageSize,
      });

      if (!isCurrent()) return false;
      if (response.code === 200 && response.data) {
        canReply.value = response.data.canReply !== false;
        const newComments = response.data.items || [];

        hasMore.value =
          response.data.meta?.totalPages != null
            ? page < response.data.meta.totalPages
            : newComments.length === pageSize;
        const unpagedIds = new Set(unpagedReplies.keys());
        const previousComments =
          page === 1 ? [] : comments.value.filter(comment => !unpagedIds.has(comment.id));
        for (const comment of newComments) unpagedReplies.delete(comment.id);
        if (!hasMore.value) unpagedReplies.clear();
        comments.value = mergeComments([
          ...previousComments,
          ...newComments,
          ...unpagedReplies.values(),
        ]);
        currentPage.value = page + 1;
        initialized.value = true;
        return true;
      }
      throw new Error(response.message || '回复加载失败，请重试');
    } catch (err) {
      if (isCurrent()) {
        failedPage = page;
        error.value = '回复加载失败，请重试';
      }
      return false;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  };

  const fetchPanelComments = (refresh = false): Promise<boolean> => {
    if (loading.value && !refresh) return Promise.resolve(false);
    return fetchPanelPage(refresh ? 1 : currentPage.value);
  };

  const retryComments = (): Promise<boolean> => {
    if (loading.value || failedPage === null) return Promise.resolve(false);
    return fetchPanelPage(failedPage);
  };

  /**
   * 加载更多评论
   */
  const loadMoreComments = () => {
    if (hasMore.value && !loading.value && !error.value) {
      return fetchPanelComments();
    }
    return Promise.resolve(false);
  };

  /**
   * 选择评论进行回复
   */
  const selectCommentForReply = (comment: Comment) => {
    if (submitting.value || !canReply.value || comment.status !== 'approved') return;
    replyingTo.value = comment;
  };

  /**
   * 取消回复
   */
  const cancelReply = () => {
    if (submitting.value) return;
    replyingTo.value = null;
  };

  /**
   * 提交回复
   */
  const submitReply = async (): Promise<boolean> => {
    if (submitting.value || disposed) return false;
    if (!replyContent.value.trim()) {
      uni.showToast({
        title: '请输入回复内容',
        icon: 'none',
      });
      return false;
    }
    if (!canReply.value) {
      uni.showToast({ title: '暂时无法回复这条评价', icon: 'none' });
      return false;
    }
    const isCurrent = captureOperation();
    const draft = replyContent.value;
    const targetId = replyingTo.value?.id;
    submitting.value = true;
    try {
      const requestData: CommentCreateRequest = {
        reviewId: reviewId(),
        content: draft.trim(),
      };

      // 如果是回复某条评论，添加 parentCommentId
      if (targetId) {
        requestData.parentCommentId = targetId;
      }

      const response = await createComment(requestData);
      if (!isCurrent()) return false;

      if (response.code === 200 || response.code === 201) {
        const savedReply = response.data;
        if (savedReply) {
          unpagedReplies.set(savedReply.id, savedReply);
          comments.value = mergeComments([...comments.value, savedReply]);
          initialized.value = true;
        }

        if (replyContent.value === draft && replyingTo.value?.id === targetId) {
          replyContent.value = '';
          replyingTo.value = null;
        }

        onCommentAdded?.();
        await fetchPanelComments(true);
        if (!isCurrent()) return false;
        return true;
      } else {
        uni.showToast({
          title: response.message || '回复失败',
          icon: 'none',
        });
      }
    } catch (err) {
      if (!isCurrent()) return false;
      console.error('提交回复失败:', err);
      uni.showToast({
        title: err instanceof Error ? err.message : '回复失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      if (isCurrent()) submitting.value = false;
    }
    return false;
  };

  const removePanelComment = async (commentId: string): Promise<boolean> => {
    if (deletingId.value || disposed) return false;
    const isCurrent = captureOperation();
    deletingId.value = commentId;
    try {
      const response = await deleteComment(commentId);
      if (!isCurrent()) return false;
      if (response.code !== 200) throw new Error(response.message || '删除失败');
      unpagedReplies.delete(commentId);
      comments.value = comments.value.filter(comment => comment.id !== commentId);
      onCommentAdded?.();
      await fetchPanelComments(true);
      if (isCurrent()) uni.showToast({ title: '删除成功', icon: 'success' });
      return true;
    } catch (error) {
      if (isCurrent())
        uni.showToast({
          title: error instanceof Error ? error.message : '删除失败，请重试',
          icon: 'none',
        });
      return false;
    } finally {
      if (isCurrent()) deletingId.value = '';
    }
  };

  /**
   * 重置面板状态
   */
  const resetPanel = () => {
    panelVersion++;
    queryVersion++;
    comments.value = [];
    unpagedReplies.clear();
    initialized.value = false;
    canReply.value = true;
    loading.value = false;
    hasMore.value = false;
    currentPage.value = 1;
    failedPage = null;
    replyContent.value = '';
    replyingTo.value = null;
    error.value = '';
    submitting.value = false;
    deletingId.value = '';
  };

  /**
   * 刷新评论列表
   */
  const refreshComments = () => {
    return fetchPanelComments(true);
  };

  watch(() => userStore.sessionVersion, resetPanel, { flush: 'sync' });
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      panelVersion++;
      unpagedReplies.clear();
    });

  return {
    comments,
    initialized,
    loading,
    error,
    submitting,
    deletingId,
    hasMore,
    replyContent,
    replyingTo,
    canSendReply,
    canReply,
    fetchPanelComments,
    loadMoreComments,
    selectCommentForReply,
    cancelReply,
    submitReply,
    resetPanel,
    refreshComments,
    retryComments,
    removePanelComment,
  };
}
