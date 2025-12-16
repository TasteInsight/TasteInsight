/// <reference types="jest" />
import { useReview } from '@/pages/dish/composables/use-review';
import { getReviewsByDish } from '@/api/modules/review';
import type { Review } from '@/types/api';

// Mock the API module
jest.mock('@/api/modules/review', () => ({
  getReviewsByDish: jest.fn(),
  createReview: jest.fn(),
  deleteReview: jest.fn(),
}));

describe('useReview', () => {
  const mockDishId = '123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { reviews, reviewsLoading, isInitializing, reviewsError, reviewsHasMore } = useReview();

    expect(reviews.value).toEqual([]);
    expect(reviewsLoading.value).toBe(false);
    expect(isInitializing.value).toBe(false);
    expect(reviewsError.value).toBe('');
    expect(reviewsHasMore.value).toBe(true);
  });

  it('should handle initialization state correctly during refresh', async () => {
    const { fetchReviews, isInitializing, reviewsLoading } = useReview();

    (getReviewsByDish as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [] }
    });

    const promise = fetchReviews(mockDishId, true);

    // During fetch
    expect(isInitializing.value).toBe(true);
    expect(reviewsLoading.value).toBe(true);

    await promise;

    // After fetch
    expect(isInitializing.value).toBe(false);
    expect(reviewsLoading.value).toBe(false);
  });

  it('should NOT set isInitializing when loading more (not refresh)', async () => {
    const { fetchReviews, isInitializing, reviewsLoading } = useReview();

    (getReviewsByDish as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [] }
    });

    const promise = fetchReviews(mockDishId, false);

    // During fetch
    expect(isInitializing.value).toBe(false); // Should remain false
    expect(reviewsLoading.value).toBe(true);

    await promise;

    expect(isInitializing.value).toBe(false);
    expect(reviewsLoading.value).toBe(false);
  });

  it('should reset state correctly on refresh', async () => {
    const { fetchReviews, reviews } = useReview();

    // Setup initial state
    reviews.value = [{ id: '1', content: 'old' } as any];

    (getReviewsByDish as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [{ id: '2', content: 'new' }] }
    });

    await fetchReviews(mockDishId, true);

    expect(reviews.value).toHaveLength(1);
    expect(reviews.value[0].id).toBe('2');
  });

  it('should handle error state and reset isInitializing', async () => {
    const { fetchReviews, isInitializing, reviewsError } = useReview();

    (getReviewsByDish as jest.Mock).mockRejectedValue(new Error('Network error'));

    const promise = fetchReviews(mockDishId, true);

    expect(isInitializing.value).toBe(true);

    await promise;

    expect(isInitializing.value).toBe(false);
    expect(reviewsError.value).toBe('网络错误，请稍后重试');
  });
});
