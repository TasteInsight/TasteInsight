/// <reference types="jest" />
import { useReview, useReviewForm } from '@/pages/dish/composables/use-review';
import { getReviewsByDish, createReview, deleteReview } from '@/api/modules/review';
import { uploadImage } from '@/api/modules/upload';
import type { Review } from '@/types/api';

// Mock the API module
jest.mock('@/api/modules/review', () => ({
  getReviewsByDish: jest.fn(),
  createReview: jest.fn(),
  deleteReview: jest.fn(),
}));

jest.mock('@/api/modules/upload', () => ({
  uploadImage: jest.fn(),
}));

// Mock uni-app APIs
const mockSetStorageSync = jest.fn();
const mockGetStorageSync = jest.fn();
const mockRemoveStorageSync = jest.fn();
const mockShowToast = jest.fn();

(global as any).uni = {
  setStorageSync: mockSetStorageSync,
  getStorageSync: mockGetStorageSync,
  removeStorageSync: mockRemoveStorageSync,
  showToast: mockShowToast,
};

describe('useReview', () => {
  const mockDishId = '123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchReviews', () => {
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

  describe('submitReview', () => {
    it('should submit review successfully', async () => {
      const { submitReview } = useReview();
      const mockPayload = { dishId: '1', rating: 5, content: 'Good' };
      (createReview as jest.Mock).mockResolvedValue({ code: 200, data: 'success' });

      const result = await submitReview(mockPayload);
      expect(result).toBe('success');
    });

    it('should throw error on failure', async () => {
      const { submitReview } = useReview();
      (createReview as jest.Mock).mockResolvedValue({ code: 400, message: 'Fail' });

      await expect(submitReview({} as any)).rejects.toThrow('Fail');
    });
  });

  describe('removeReview', () => {
    it('should remove review from list on success', async () => {
      const { removeReview, reviews } = useReview();
      reviews.value = [{ id: '1' }, { id: '2' }] as any;
      (deleteReview as jest.Mock).mockResolvedValue({ code: 200 });

      await removeReview('1');

      expect(reviews.value).toHaveLength(1);
      expect(reviews.value[0].id).toBe('2');
    });

    it('should throw error on failure', async () => {
      const { removeReview } = useReview();
      (deleteReview as jest.Mock).mockResolvedValue({ code: 400, message: 'Fail' });

      await expect(removeReview('1')).rejects.toThrow('Fail');
    });
  });
});

describe('useReviewForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize form state', () => {
    const { rating, content, images, flavorRatings } = useReviewForm();
    expect(rating.value).toBe(0);
    expect(content.value).toBe('');
    expect(images.value).toEqual([]);
    expect(flavorRatings.value.spicyLevel).toBe(0);
  });

  it('should set rating and flavor', () => {
    const { setRating, setFlavorRating, rating, flavorRatings } = useReviewForm();
    
    setRating(5);
    expect(rating.value).toBe(5);

    setFlavorRating('spicyLevel', 3);
    expect(flavorRatings.value.spicyLevel).toBe(3);

    // Toggle off
    setFlavorRating('spicyLevel', 3);
    expect(flavorRatings.value.spicyLevel).toBe(0);
  });

  it('should reset form', () => {
    const { resetForm, rating, content, flavorRatings } = useReviewForm();
    rating.value = 5;
    content.value = 'test';
    flavorRatings.value.spicyLevel = 3;

    resetForm();

    expect(rating.value).toBe(0);
    expect(content.value).toBe('');
    expect(flavorRatings.value.spicyLevel).toBe(0);
  });

  it('should save and load review state', () => {
    const { saveReviewState, loadReviewState, rating } = useReviewForm();
    rating.value = 4;

    saveReviewState('123');
    expect(mockSetStorageSync).toHaveBeenCalledWith('review_state_123', expect.objectContaining({ rating: 4 }));

    mockGetStorageSync.mockReturnValue({ rating: 4, timestamp: Date.now() });
    const loaded = loadReviewState('123');
    expect(loaded).toBe(true);
    expect(rating.value).toBe(4);
  });

  it('should upload images', async () => {
    const { uploadImages, images } = useReviewForm();
    (uploadImage as jest.Mock).mockResolvedValue({ url: 'http://img.com/1.jpg' });

    await uploadImages(['path/to/img']);

    expect(images.value).toContain('http://img.com/1.jpg');
  });

  it('should handle submit validation', async () => {
    const { handleSubmit, rating, setFlavorRating } = useReviewForm();
    
    // No rating
    await handleSubmit('123');
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '请先选择总体评分' }));

    // Incomplete flavor
    rating.value = 5;
    setFlavorRating('spicyLevel', 3); // Only one flavor set
    
    await handleSubmit('123');
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '请选择全部口味评分或全部留空' }));
  });

  it('should submit successfully', async () => {
    const { handleSubmit, rating, content } = useReviewForm();
    rating.value = 5;
    content.value = 'Great';
    (createReview as jest.Mock).mockResolvedValue({ code: 200 });

    await handleSubmit('123');

    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({
      dishId: '123',
      rating: 5,
      content: 'Great'
    }));
    expect(rating.value).toBe(0); // Reset after success
  });
});
