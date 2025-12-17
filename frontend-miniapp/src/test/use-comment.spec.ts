/// <reference types="jest" />
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
        meta: { total: 1 }
      }
    };
    (getCommentsByReview as jest.Mock).mockResolvedValue(mockResponse);

    await fetchComments(mockReviewId);

    expect(getCommentsByReview).toHaveBeenCalledWith(mockReviewId, { page: 1, pageSize: 5 });
    expect(reviewComments.value[mockReviewId]).toEqual({
      items: mockResponse.data.items,
      total: 1,
      loading: false
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
      parentId: null
    };
    const mockResponse = {
      code: 200,
      data: { id: 'new-1', ...mockPayload }
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
      message: 'Server error'
    });

    await expect(submitComment({
      reviewId: mockReviewId,
      content: 'Fail',
      parentCommentId: undefined
    })).rejects.toThrow('Server error');
  });

  it('should remove comment successfully', async () => {
    const { removeComment, reviewComments } = useComment();
    
    // Setup initial state
    reviewComments.value[mockReviewId] = {
      items: [{ id: mockCommentId, content: 'To delete' } as any],
      total: 1,
      loading: false
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
    const { comments, loading, hasMore, replyContent, replyingTo } = useCommentPanel(() => mockReviewId);
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
      data: { items: [{ id: '1' }] }
    });

    await fetchPanelComments();

    expect(comments.value).toHaveLength(1);
    expect(hasMore.value).toBe(false); // Less than page size (10)
  });

  it('should load more comments', async () => {
    const { loadMoreComments, fetchPanelComments, comments, hasMore } = useCommentPanel(() => mockReviewId);
    
    // First page full
    (getCommentsByReview as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: { items: new Array(10).fill({ id: 'x' }) }
    });

    await fetchPanelComments();
    expect(hasMore.value).toBe(true);

    // Load more
    (getCommentsByReview as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'new' }] }
    });

    await loadMoreComments(); // This is async but function is void, so we wait for promise resolution implicitly or mock implementation
    
    // Since loadMoreComments calls fetchPanelComments which is async, we need to wait.
    // But loadMoreComments doesn't return the promise.
    // We can wait for next tick or use jest.runAllTicks if using fake timers, or just await a small delay.
    // Better: check if getCommentsByReview was called with page 2
    expect(getCommentsByReview).toHaveBeenLastCalledWith(mockReviewId, expect.objectContaining({ page: 2 }));
  });

  it('should handle reply selection', () => {
    const { selectCommentForReply, cancelReply, replyingTo } = useCommentPanel(() => mockReviewId);
    const comment = { id: '1' } as any;
    
    selectCommentForReply(comment);
    expect(replyingTo.value).toStrictEqual(comment);

    cancelReply();
    expect(replyingTo.value).toBeNull();
  });

  it('should submit reply successfully', async () => {
    const { submitReply, replyContent, replyingTo } = useCommentPanel(() => mockReviewId, mockOnCommentAdded);
    replyContent.value = 'Reply';
    replyingTo.value = { id: 'parent' } as any;

    (createComment as jest.Mock).mockResolvedValue({ code: 200 });
    // Mock fetchPanelComments inside submitReply
    (getCommentsByReview as jest.Mock).mockResolvedValue({ code: 200, data: { items: [] } });

    await submitReply();

    expect(createComment).toHaveBeenCalledWith({
      reviewId: mockReviewId,
      content: 'Reply',
      parentCommentId: 'parent'
    });
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '回复成功' }));
    expect(mockOnCommentAdded).toHaveBeenCalled();
    expect(replyContent.value).toBe('');
    expect(replyingTo.value).toBeNull();
  });

  it('should validate empty reply', async () => {
    const { submitReply, replyContent } = useCommentPanel(() => mockReviewId);
    replyContent.value = '   ';

    await submitReply();

    expect(createComment).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '请输入回复内容' }));
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
