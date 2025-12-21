import { useRecommendDishes } from '@/pages/index/composables/use-recommend-dishes';
import { getDishes } from '@/api/modules/dish';
import { ref } from 'vue';

// Mock the API module
jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn(),
}));

describe('useRecommendDishes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { dishes, loading } = useRecommendDishes();
    expect(dishes.value).toEqual([]);
    expect(loading.value).toBe(false);
  });

  it('should fetch dishes successfully', async () => {
    const mockDishes = [
      { id: 1, name: 'Dish 1', price: 10 },
      { id: 2, name: 'Dish 2', price: 20 },
    ];
    (getDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: mockDishes,
        total: 2,
      },
      msg: 'success',
    });

    const { dishes, loading, fetchDishes } = useRecommendDishes();

    const fetchPromise = fetchDishes();
    expect(loading.value).toBe(true);

    await fetchPromise;

    expect(loading.value).toBe(false);
    expect(dishes.value).toEqual(mockDishes);
    expect(getDishes).toHaveBeenCalledWith(expect.objectContaining({
      isSuggestion: true,
      sort: { field: 'averageRating', order: 'desc' },
    }));
  });

  it('should handle fetch error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getDishes as jest.Mock).mockRejectedValue(new Error('Network Error'));

    const { dishes, loading, fetchDishes } = useRecommendDishes();

    await fetchDishes();

    expect(loading.value).toBe(false);
    expect(dishes.value).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith('获取推荐菜品失败:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should not fetch if already loading', async () => {
    const { loading, fetchDishes } = useRecommendDishes();

    loading.value = true;
    await fetchDishes();

    expect(getDishes).not.toHaveBeenCalled();
  });
});
