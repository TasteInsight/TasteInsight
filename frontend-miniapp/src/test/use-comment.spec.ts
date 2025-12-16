/// <reference types="jest" />
import { useComment } from '@/pages/dish/composables/use-comment';
import { getCommentsByReview, createComment, deleteComment } from '@/api/modules/comment';

// Mock the API module
jest.mock('@/api/modules/comment', () => ({
  getCommentsByReview: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
}));

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
