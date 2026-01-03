import { useRecommendDishes } from '@/pages/index/composables/use-recommend-dishes';
import { getRecommendations, RecommendationScene } from '@/api/modules/recommendation';
import { getDishesByIds } from '@/api/modules/dish';

// Mock the API modules
jest.mock('@/api/modules/recommendation', () => ({
  getRecommendations: jest.fn(),
  RecommendationScene: {
    HOME: 'home',
    SEARCH: 'search',
    SIMILAR: 'similar',
    GUESS_LIKE: 'guess_like',
    TODAY: 'today',
  },
}));

jest.mock('@/api/modules/dish', () => ({
  getDishesByIds: jest.fn(),
}));

describe('useRecommendDishes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { dishes, loading, requestId } = useRecommendDishes();
    expect(dishes.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(requestId.value).toBeNull();
  });

  it('should fetch dishes successfully using recommendation API', async () => {
    const mockRecommendationResponse = {
      code: 200,
      data: {
        items: [
          { id: 'dish-1', score: 0.95 },
          { id: 'dish-2', score: 0.88 },
        ],
        meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
        requestId: 'test-request-id-123',
      },
    };

    const mockDishes = [
      { id: 'dish-1', name: 'Dish 1', price: 10 },
      { id: 'dish-2', name: 'Dish 2', price: 20 },
    ];

    (getRecommendations as jest.Mock).mockResolvedValue(mockRecommendationResponse);
    (getDishesByIds as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: mockDishes,
        meta: { page: 1, pageSize: 2, total: 2, totalPages: 1 },
      },
    });

    const { dishes, loading, requestId, fetchDishes } = useRecommendDishes();

    const fetchPromise = fetchDishes();
    expect(loading.value).toBe(true);

    await fetchPromise;

    expect(loading.value).toBe(false);
    expect(dishes.value).toEqual(mockDishes);
    expect(requestId.value).toBe('test-request-id-123');
    
    // 验证推荐 API 调用
    expect(getRecommendations).toHaveBeenCalledWith({
      scene: RecommendationScene.HOME,
      requestId: undefined,
      filter: {},
      pagination: { page: 1, pageSize: 10 },
    });

    // 验证批量获取菜品调用
    expect(getDishesByIds).toHaveBeenCalledWith(['dish-1', 'dish-2']);
  });

  it('should fetch dishes with filter', async () => {
    const mockRecommendationResponse = {
      code: 200,
      data: {
        items: [{ id: 'dish-1', score: 0.95 }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        requestId: 'test-request-id',
      },
    };

    (getRecommendations as jest.Mock).mockResolvedValue(mockRecommendationResponse);
    (getDishesByIds as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'dish-1', name: 'Dish 1', price: 10 }],
        meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
      },
    });

    const { fetchDishes } = useRecommendDishes();
    const filter = { canteenId: ['canteen-1'] };

    await fetchDishes(filter);

    expect(getRecommendations).toHaveBeenCalledWith({
      scene: RecommendationScene.HOME,
      requestId: undefined,
      filter,
      pagination: { page: 1, pageSize: 10 },
    });
  });

  it('should handle empty recommendation results', async () => {
    (getRecommendations as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
        requestId: 'test-request-id',
      },
    });

    const { dishes, fetchDishes } = useRecommendDishes();

    await fetchDishes();

    expect(dishes.value).toEqual([]);
    expect(getDishesByIds).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getRecommendations as jest.Mock).mockRejectedValue(new Error('Network Error'));

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

    expect(getRecommendations).not.toHaveBeenCalled();
    expect(getDishesByIds).not.toHaveBeenCalled();
  });

  it('should maintain dish order as per recommendation score', async () => {
    // 验证 composable 能正确根据推荐 API 的顺序重排菜品
    // 推荐 API 返回按分数排序的 ID (dish-2, dish-1, dish-3)
    // 但 getDishesByIds 返回的菜品是乱序的 (dish-1, dish-2, dish-3)
    // 最终结果应该按推荐 API 的顺序排列
    
    const mockRecommendationResponse = {
      code: 200,
      data: {
        items: [
          { id: 'dish-2', score: 0.95 },
          { id: 'dish-1', score: 0.88 },
          { id: 'dish-3', score: 0.75 },
        ],
        meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
        requestId: 'test-request-id',
      },
    };

    // 注意：这里返回的菜品顺序与推荐 API 不同
    // 这模拟了真实场景，因为 getDishesByIds 不保证返回顺序
    const mockDishes = [
      { id: 'dish-1', name: 'Dish 1' },
      { id: 'dish-2', name: 'Dish 2' },
      { id: 'dish-3', name: 'Dish 3' },
    ];

    (getRecommendations as jest.Mock).mockResolvedValue(mockRecommendationResponse);
    (getDishesByIds as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: mockDishes,
        meta: { page: 1, pageSize: 3, total: 3, totalPages: 1 },
      },
    });

    const { dishes, fetchDishes } = useRecommendDishes();

    await fetchDishes();

    // 验证：最终顺序应该与推荐 API 返回的顺序一致（按分数从高到低）
    // 这证明了 composable 正确实现了重排序逻辑
    expect(dishes.value.map(d => d.id)).toEqual(['dish-2', 'dish-1', 'dish-3']);
  });
});
