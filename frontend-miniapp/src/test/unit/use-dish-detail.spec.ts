/// <reference types="jest" />
import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';
import { useReview } from '@/pages/dish/composables/use-review';
import { useComment } from '@/pages/dish/composables/use-comment';
import { useUserStore } from '@/store/modules/use-user-store';
import { getDishById } from '@/api/modules/dish';

// Mock APIs
jest.mock('@/api/modules/dish', () => ({
  getDishById: jest.fn(),
  favoriteDish: jest.fn(),
  unfavoriteDish: jest.fn(),
}));

// Mock composables
jest.mock('@/pages/dish/composables/use-review');
jest.mock('@/pages/dish/composables/use-comment');
jest.mock('@/store/modules/use-user-store');

// Mock uni-app APIs
const mockShowToast = jest.fn();
(global as any).uni = {
  showToast: mockShowToast,
};

describe('useDishDetail', () => {
  let mockUseReview: any;
  let mockUseComment: any;
  let mockUseUserStore: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock useReview
    mockUseReview = {
      reviews: { value: [] },
      reviewsLoading: { value: false },
      isInitializing: { value: false },
      reviewsError: { value: '' },
      reviewsHasMore: { value: true },
      fetchReviews: jest.fn(),
      removeReview: jest.fn(),
      submitReview: jest.fn()
    };
    (useReview as any).mockReturnValue(mockUseReview);

    // Mock useComment
    mockUseComment = {
      reviewComments: { value: {} },
      fetchComments: jest.fn(),
      removeComment: jest.fn(),
      submitComment: jest.fn()
    };
    (useComment as any).mockReturnValue(mockUseComment);

    // Mock useUserStore
    mockUseUserStore = {
      userInfo: { value: { myFavoriteDishes: [] } },
      isLoggedIn: { value: true },
      updateLocalUserInfo: jest.fn()
    };
    (useUserStore as any).mockReturnValue(mockUseUserStore);
  });

  describe('removeReview', () => {
    it('should refresh reviews and dish detail after successful removal', async () => {
      // Arrange
      const { removeReview, fetchDishDetail } = useDishDetail();
      const reviewId = 'review-123';
      const dishId = 'dish-456';

      // Mock dish API response
      const mockDish = { id: dishId, reviewCount: 5 };
      (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: mockDish });

      // Load dish first
      await fetchDishDetail(dishId);

      // Mock successful removal
      mockUseReview.removeReview.mockResolvedValueOnce(undefined);
      mockUseReview.fetchReviews.mockResolvedValueOnce(undefined);

      // Act
      await removeReview(reviewId);

      // Assert
      expect(mockUseReview.removeReview).toHaveBeenCalledWith(reviewId);
      expect(mockUseReview.fetchReviews).toHaveBeenCalledWith(dishId, true);
      expect(mockShowToast).toHaveBeenCalledWith({ title: '删除成功', icon: 'success' });
    });

    it('should handle removal failure gracefully', async () => {
      // Arrange
      const { removeReview } = useDishDetail();
      const reviewId = 'review-123';
      const errorMessage = '删除失败';

      // Mock failed removal
      mockUseReview.removeReview.mockRejectedValueOnce(new Error(errorMessage));

      // Act
      await removeReview(reviewId);

      // Assert
      expect(mockUseReview.removeReview).toHaveBeenCalledWith(reviewId);
      expect(mockShowToast).toHaveBeenCalledWith({ title: errorMessage, icon: 'none' });
    });
  });

  describe('removeComment', () => {
    it('should refresh comments after successful removal', async () => {
      // Arrange
      const { removeComment } = useDishDetail();
      const commentId = 'comment-123';
      const reviewId = 'review-456';

      // Mock successful removal
      mockUseComment.removeComment.mockResolvedValueOnce(undefined);
      mockUseComment.fetchComments.mockResolvedValueOnce(undefined);

      // Act
      await removeComment(commentId, reviewId);

      // Assert
      expect(mockUseComment.removeComment).toHaveBeenCalledWith(commentId, reviewId);
      expect(mockUseComment.fetchComments).toHaveBeenCalledWith(reviewId);
      expect(mockShowToast).toHaveBeenCalledWith({ title: '删除成功', icon: 'success' });
    });

    it('should handle removal failure gracefully', async () => {
      // Arrange
      const { removeComment } = useDishDetail();
      const commentId = 'comment-123';
      const reviewId = 'review-456';
      const errorMessage = '删除失败';

      // Mock failed removal
      mockUseComment.removeComment.mockRejectedValueOnce(new Error(errorMessage));

      // Act
      await removeComment(commentId, reviewId);

      // Assert
      expect(mockUseComment.removeComment).toHaveBeenCalledWith(commentId, reviewId);
      expect(mockShowToast).toHaveBeenCalledWith({ title: errorMessage, icon: 'none' });
    });
  });

  describe('fetchDishDetail and related flows', () => {
    it('loads sub and parent dishes when available', async () => {
      (getDishById as jest.Mock)
        .mockResolvedValueOnce({ code: 200, data: { id: 'd1', subDishId: ['s1'], parentDishId: 'p1' } })
        .mockResolvedValueOnce({ code: 200, data: { id: 's1' } })
        .mockResolvedValueOnce({ code: 200, data: { id: 'p1' } });

      const { fetchDishDetail, dish, subDishes, parentDish } = useDishDetail();
      await fetchDishDetail('d1');

      expect(dish.value?.id).toBe('d1');
      expect(subDishes.value[0].id).toBe('s1');
      expect(parentDish.value?.id).toBe('p1');
    });

    it('sets error on non-200 response', async () => {
      (getDishById as jest.Mock).mockResolvedValueOnce({ code: 500, message: 'nope' });
      const { fetchDishDetail, error } = useDishDetail();
      await fetchDishDetail('bad');
      expect(error.value).toBe('nope');
    });
  });

  describe('toggleFavorite', () => {
    it('skips when no dish id or not logged in and handles favorite/unfavorite success', async () => {
      const user = (useUserStore() as any);
      const { toggleFavorite, dish, favoriteLoading } = useDishDetail();

      // no dish id
      dish.value = {} as any;
      await toggleFavorite();
      expect(favoriteLoading.value).toBe(false);

      // not logged in
      user.isLoggedIn = false;
      dish.value = { id: 'd1' } as any;
      await toggleFavorite();
      expect(mockShowToast).toHaveBeenCalled();

      // logged in and favorite
      user.isLoggedIn = true;
      user.userInfo = { myFavoriteDishes: [] };
      (require('@/api/modules/dish').favoriteDish as jest.Mock).mockResolvedValueOnce({ code: 200 });
      (require('@/api/modules/dish').unfavoriteDish as jest.Mock).mockResolvedValueOnce({ code: 200 });

      dish.value = { id: 'd1' } as any;
      await toggleFavorite();
      expect(user.updateLocalUserInfo).toHaveBeenCalled();

      // now simulate already favorited -> unfavorite
      user.userInfo = { myFavoriteDishes: ['d1'] };
      dish.value = { id: 'd1' } as any;
      await toggleFavorite();
      expect(user.updateLocalUserInfo).toHaveBeenCalled();
    });
  });

});