/// <reference types="jest" />
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0 }),
}));
import { useComment, useCommentPanel } from '@/pages/dish/composables/use-comment';
import { getCommentsByReview, createComment, deleteComment } from '@/api/modules/comment';

// Mock the API module
jest.mock('@/api/modules/comment', () => ({
  getCommentsByReview: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
}));

// Mock uni-app APIs
const mockShowToast = jest.fn();
(global as any).uni = {
  showToast: mockShowToast,
};

describe('useComment', () => {
  const mockReviewId = 'review-123';
  const mockCommentId = 'comment-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { reviewComments } = useComment();
    expect(reviewComments.value).toEqual({});
  });

  it('should fetch comments successfully', async () => {
    const { fetchComments, reviewComments } = useComment();

    const mockResponse = {
      code: 200,
      data: {
        items: [{ id: '1', content: 'Test comment' }],
        meta: { total: 1 },
      },
    };
    (getCommentsByReview as jest.Mock).mockResolvedValue(mockResponse);

    await fetchComments(mockReviewId);

    expect(getCommentsByReview).toHaveBeenCalledWith(mockReviewId, { page: 1, pageSize: 5 });
    expect(reviewComments.value[mockReviewId]).toEqual({
      items: mockResponse.data.items,
      total: 1,
      loading: false,
    });
  });

  it('should handle fetch error', async () => {
    const { fetchComments, reviewComments } = useComment();

    (getCommentsByReview as jest.Mock).mockRejectedValue(new Error('Network error'));

    await fetchComments(mockReviewId);

    expect(reviewComments.value[mockReviewId].loading).toBe(false);
    expect(reviewComments.value[mockReviewId].items).toEqual([]);
  });

  it('should submit comment successfully', async () => {
    const { submitComment } = useComment();

    const mockPayload = {
      reviewId: mockReviewId,
      content: 'New comment',
      parentId: null,
    };
    const mockResponse = {
      code: 200,
      data: { id: 'new-1', ...mockPayload },
    };
    (createComment as jest.Mock).mockResolvedValue(mockResponse);

    const result = await submitComment(mockPayload);

    expect(createComment).toHaveBeenCalledWith(mockPayload);
    expect(result).toEqual(mockResponse.data);
  });

  it('should handle submit error', async () => {
    const { submitComment } = useComment();

    (createComment as jest.Mock).mockResolvedValue({
      code: 500,
      message: 'Server error',
    });

    await expect(
      submitComment({
        reviewId: mockReviewId,
        content: 'Fail',
        parentCommentId: undefined,
      })
    ).rejects.toThrow('Server error');
  });

  it('should remove comment successfully', async () => {
    const { removeComment, reviewComments } = useComment();

    // Setup initial state
    reviewComments.value[mockReviewId] = {
      items: [{ id: mockCommentId, content: 'To delete' } as any],
      total: 1,
      loading: false,
    };

    (deleteComment as jest.Mock).mockResolvedValue({ code: 200 });

    await removeComment(mockCommentId, mockReviewId);

    expect(deleteComment).toHaveBeenCalledWith(mockCommentId);
    expect(reviewComments.value[mockReviewId].items).toHaveLength(0);
    expect(reviewComments.value[mockReviewId].total).toBe(0);
  });
});

describe('useCommentPanel', () => {
  const mockReviewId = 'review-123';
  const mockOnCommentAdded = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize panel state', () => {
    const { comments, loading, hasMore, replyContent, replyingTo } = useCommentPanel(
      () => mockReviewId
    );
    expect(comments.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(hasMore.value).toBe(false);
    expect(replyContent.value).toBe('');
    expect(replyingTo.value).toBeNull();
  });

  it('should fetch panel comments', async () => {
    const { fetchPanelComments, comments, hasMore } = useCommentPanel(() => mockReviewId);
    (getCommentsByReview as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [{ id: '1' }] },
    });

    await fetchPanelComments();

    expect(comments.value).toHaveLength(1);
    expect(hasMore.value).toBe(false); // Less than page size (10)
  });

  it('should load more comments', async () => {
    const { loadMoreComments, fetchPanelComments, comments, hasMore } = useCommentPanel(
      () => mockReviewId
    );

    // First page full
    (getCommentsByReview as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: { items: new Array(10).fill({ id: 'x' }) },
    });

    await fetchPanelComments();
    expect(hasMore.value).toBe(true);

    // Load more
    (getCommentsByReview as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'new' }] },
    });

    await loadMoreComments(); // This is async but function is void, so we wait for promise resolution implicitly or mock implementation

    // Since loadMoreComments calls fetchPanelComments which is async, we need to wait.
    // But loadMoreComments doesn't return the promise.
    // We can wait for next tick or use jest.runAllTicks if using fake timers, or just await a small delay.
    // Better: check if getCommentsByReview was called with page 2
    expect(getCommentsByReview).toHaveBeenLastCalledWith(
      mockReviewId,
      expect.objectContaining({ page: 2 })
    );
  });

  it('should handle reply selection', () => {
    const { selectCommentForReply, cancelReply, replyingTo } = useCommentPanel(() => mockReviewId);
    const comment = { id: '1', status: 'approved' } as any;

    selectCommentForReply(comment);
    expect(replyingTo.value).toStrictEqual(comment);

    cancelReply();
    expect(replyingTo.value).toBeNull();
  });

  it('should submit reply successfully', async () => {
    const { submitReply, replyContent, replyingTo } = useCommentPanel(
      () => mockReviewId,
      mockOnCommentAdded
    );
    replyContent.value = 'Reply';
    replyingTo.value = { id: 'parent' } as any;

    (createComment as jest.Mock).mockResolvedValue({ code: 200 });
    // Mock fetchPanelComments inside submitReply
    (getCommentsByReview as jest.Mock).mockResolvedValue({ code: 200, data: { items: [] } });

    await submitReply();

    expect(createComment).toHaveBeenCalledWith({
      reviewId: mockReviewId,
      content: 'Reply',
      parentCommentId: 'parent',
    });
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockOnCommentAdded).toHaveBeenCalled();
    expect(replyContent.value).toBe('');
    expect(replyingTo.value).toBeNull();
  });

  it('should validate empty reply', async () => {
    const { submitReply, replyContent } = useCommentPanel(() => mockReviewId);
    replyContent.value = '   ';

    await submitReply();

    expect(createComment).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '请输入回复内容' })
    );
  });

  it('keeps a submitted pending reply visible without a redundant success toast', async () => {
    const reply = {
      id: 'pending-reply',
      reviewId: mockReviewId,
      userId: 'viewer',
      userNickname: '作者',
      userAvatar: '',
      floor: 1,
      parentComment: null,
      content: '待审核回复',
      status: 'pending',
      createdAt: '2026-10-08T12:00:00Z',
    };
    const panel = useCommentPanel(() => mockReviewId);
    (getCommentsByReview as jest.Mock)
      .mockResolvedValueOnce({
        code: 200,
        data: {
          items: [],
          canReply: true,
          meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
        },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: {
          items: [reply],
          canReply: true,
          meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      });
    await panel.fetchPanelComments();
    panel.replyContent.value = reply.content;
    (createComment as jest.Mock).mockResolvedValue({ code: 201, message: '已提交', data: reply });
    expect(await panel.submitReply()).toBe(true);
    expect(panel.comments.value[0]).toMatchObject({ content: '待审核回复', status: 'pending' });
    expect(panel.replyContent.value).toBe('');
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('does not submit a reply when its parent review is not public', async () => {
    const panel = useCommentPanel(() => mockReviewId);
    (getCommentsByReview as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [],
        canReply: false,
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      },
    });
    await panel.fetchPanelComments();
    panel.replyContent.value = '保留草稿';
    expect(panel.canSendReply.value).toBe(false);
    expect(await panel.submitReply()).toBe(false);
    expect(createComment).not.toHaveBeenCalled();
    expect(panel.replyContent.value).toBe('保留草稿');
  });

  it('keeps a newly saved reply visible beyond page one and merges it once in chronological order', async () => {
    const makeReply = (floor: number) => ({
      id: 'reply-' + floor,
      reviewId: mockReviewId,
      userId: 'viewer',
      userNickname: '作者',
      userAvatar: '',
      floor,
      parentComment: null,
      content: '回复 ' + floor,
      status: 'pending',
      createdAt: new Date(Date.UTC(2026, 9, 8, 12, 0, floor)).toISOString(),
    });
    const older = Array.from({ length: 10 }, (_, index) => makeReply(index + 1));
    const saved = makeReply(13);
    const page = (items: any[], number: number, total: number) => ({
      code: 200,
      data: { items, canReply: true, meta: { page: number, pageSize: 10, total, totalPages: 2 } },
    });
    (getCommentsByReview as jest.Mock)
      .mockResolvedValueOnce(page(older, 1, 12))
      .mockResolvedValueOnce(page(older, 1, 13))
      .mockResolvedValueOnce(page([makeReply(11), makeReply(12), saved], 2, 13));
    (createComment as jest.Mock).mockResolvedValue({ code: 201, data: saved });
    const panel = useCommentPanel(() => mockReviewId);
    await panel.fetchPanelComments();
    panel.replyContent.value = saved.content;
    expect(await panel.submitReply()).toBe(true);
    expect(panel.comments.value.map(reply => reply.id)).toEqual([
      ...older.map(reply => reply.id),
      saved.id,
    ]);
    expect(panel.hasMore.value).toBe(true);
    await panel.loadMoreComments();
    expect(panel.comments.value.map(reply => reply.id)).toEqual(
      Array.from({ length: 13 }, (_, index) => 'reply-' + (index + 1))
    );
    expect(panel.hasMore.value).toBe(false);
  });

  it('shows the saved reply even when the follow-up read fails without turning a successful write into failure', async () => {
    const saved = {
      id: 'saved',
      reviewId: mockReviewId,
      userId: 'viewer',
      userNickname: '作者',
      userAvatar: '',
      floor: 1,
      parentComment: null,
      content: '已保存的回复',
      status: 'pending',
      createdAt: '2026-10-08T12:00:00Z',
    };
    (getCommentsByReview as jest.Mock)
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [], canReply: true, meta: { totalPages: 0 } },
      })
      .mockRejectedValueOnce(new Error('timeout'));
    (createComment as jest.Mock).mockResolvedValue({ code: 201, data: saved });
    const panel = useCommentPanel(() => mockReviewId);
    await panel.fetchPanelComments();
    panel.replyContent.value = saved.content;
    expect(await panel.submitReply()).toBe(true);
    expect(panel.comments.value).toEqual([saved]);
    expect(panel.replyContent.value).toBe('');
    expect(panel.error.value).toContain('回复加载失败');
  });

  it('retains a confirmed write through page-one retry and hands it back to the server page when reached', async () => {
    const replies = Array.from({ length: 26 }, (_, index) => ({
      id: 'r-' + (index + 1),
      reviewId: mockReviewId,
      userId: 'viewer',
      userNickname: '作者',
      userAvatar: '',
      floor: index + 1,
      parentComment: null,
      content: '回复 ' + (index + 1),
      status: 'pending',
      createdAt: new Date(Date.UTC(2026, 9, 8, 12, 0, index)).toISOString(),
    }));
    const page = (number: number, total: number, items: any[]) => ({
      code: 200,
      data: { items, canReply: true, meta: { page: number, pageSize: 10, total, totalPages: 3 } },
    });
    (getCommentsByReview as jest.Mock)
      .mockResolvedValueOnce(page(1, 25, replies.slice(0, 10)))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(page(1, 26, replies.slice(0, 10)))
      .mockResolvedValueOnce(page(2, 26, replies.slice(10, 20)))
      .mockResolvedValueOnce(
        page(3, 26, [...replies.slice(20, 25), { ...replies[25], status: 'approved' }])
      );
    (createComment as jest.Mock).mockResolvedValue({ code: 201, data: replies[25] });
    const panel = useCommentPanel(() => mockReviewId);
    await panel.fetchPanelComments();
    panel.replyContent.value = replies[25].content;
    expect(await panel.submitReply()).toBe(true);
    expect(await panel.retryComments()).toBe(true);
    expect(panel.comments.value.some(reply => reply.id === replies[25].id)).toBe(true);
    await panel.loadMoreComments();
    expect(panel.comments.value.some(reply => reply.id === replies[25].id)).toBe(true);
    await panel.loadMoreComments();
    expect(panel.comments.value.map(reply => reply.id)).toEqual(replies.map(reply => reply.id));
    expect(panel.comments.value[25].status).toBe('approved');
    expect(panel.hasMore.value).toBe(false);
  });

  it('should reset panel', () => {
    const { resetPanel, comments, replyContent } = useCommentPanel(() => mockReviewId);
    comments.value = [{ id: '1' }] as any;
    replyContent.value = 'draft';

    resetPanel();

    expect(comments.value).toEqual([]);
    expect(replyContent.value).toBe('');
  });
});
