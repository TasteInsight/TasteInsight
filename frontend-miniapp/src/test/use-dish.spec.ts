import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';import { getDishById, favoriteDish, unfavoriteDish } from '@/api/modules/dish';
import { useUserStore } from '@/store/modules/use-user-store';
import { ref } from 'vue';

// Mock API
jest.mock('@/api/modules/dish', () => ({
  getDishById: jest.fn(),
  favoriteDish: jest.fn(),
  unfavoriteDish: jest.fn(),
}));

// Mock Store
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));

// Mock useReview
jest.mock('@/pages/dish/composables/use-review', () => {
  const { ref } = jest.requireActual('vue');
  return {
    useReview: () => ({
      reviews: ref([]),
      reviewsLoading: ref(false),
      isInitializing: ref(false),
      reviewsError: ref(''),
      hasMoreReviews: ref(false),
      fetchReviews: jest.fn(),
      loadMoreReviews: jest.fn(),
    })
  };
});

// Mock useComment
jest.mock('@/pages/dish/composables/use-comment', () => {
  const { ref } = jest.requireActual('vue');
  return {
    useComment: () => ({
      reviewComments: ref({}),
      fetchComments: jest.fn(),
      submitComment: jest.fn(),
      removeComment: jest.fn(),
    })
  };
});

// Mock global.uni
(global as any).uni = {
  showToast: jest.fn(),
};

describe('useDishDetail', () => {
  let mockUserStore: any;

  beforeEach(() => {
    mockUserStore = {
      userInfo: { myFavoriteDishes: [] },
      isLoggedIn: true,
      updateLocalUserInfo: jest.fn(),
    };
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockUserStore);
    jest.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    const { fetchDishDetail, dish, loading } = useDishDetail();
    const mockDish = { id: '1', name: 'Test Dish' };

    (getDishById as jest.Mock).mockResolvedValue({
      code: 200,
      data: mockDish,
    });

    await fetchDishDetail('1');

    expect(loading.value).toBe(false);
    expect(dish.value).toEqual(mockDish);
  });

  it('should handle init error', async () => {
    const { fetchDishDetail, error } = useDishDetail();

    (getDishById as jest.Mock).mockRejectedValue(new Error('API Error'));

    await fetchDishDetail('1');

    expect(error.value).toBe('API Error');
  });

  it('should toggle favorite', async () => {
    const { toggleFavorite, isFavorited, fetchDishDetail } = useDishDetail();
    
    // Mock dish loaded
    (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: { id: '1' } });
    await fetchDishDetail('1');

    // Test favorite
    (favoriteDish as jest.Mock).mockResolvedValue({ code: 200 });
    await toggleFavorite();
    
    expect(favoriteDish).toHaveBeenCalledWith('1');
    expect(mockUserStore.updateLocalUserInfo).toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '收藏成功' }));
  });
});
