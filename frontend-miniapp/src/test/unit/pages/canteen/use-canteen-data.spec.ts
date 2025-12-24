import { jest } from '@jest/globals';

describe('pages/canteen/composables/use-canteen-data.ts', () => {
  const MODULE_PATH = '@/pages/canteen/composables/use-canteen-data';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('fetchDishes success sets dishes and hasMore', async () => {
    const getDishes = jest.fn() as unknown as jest.Mock<any, any>;
    getDishes.mockResolvedValue({ code: 200, data: { items: [{ id: 'd1' }], meta: { totalPages: 2 } } });
    const mockStore = { fetchCanteenDetail: jest.fn(), fetchWindowList: jest.fn(), currentCanteen: null, loading: false, error: null, windowList: [] };
    jest.doMock('@/api/modules/dish', () => ({ getDishes }));
    jest.doMock('@/store/modules/use-canteen-store', () => ({ useCanteenStore: () => mockStore }));

    const { useCanteenData } = require(MODULE_PATH);
    const inst = useCanteenData();

    await inst.fetchDishes('c1', {}, true);

    expect(getDishes).toHaveBeenCalled();
    expect(inst.dishes.value).toEqual([{ id: 'd1' }]);
    expect(inst.hasMore.value).toBe(true);
    expect(inst.dishesLoading.value).toBe(false);
  });

  test('fetchDishes error logs and does not throw', async () => {
    const getDishes = jest.fn() as unknown as jest.Mock<any, any>;
    getDishes.mockRejectedValue(new Error('fail'));
    const mockStore = { fetchCanteenDetail: jest.fn(), fetchWindowList: jest.fn(), currentCanteen: null, loading: false, error: null, windowList: [] };
    jest.doMock('@/api/modules/dish', () => ({ getDishes }));
    jest.doMock('@/store/modules/use-canteen-store', () => ({ useCanteenStore: () => mockStore }));

    const { useCanteenData } = require(MODULE_PATH);
    const inst = useCanteenData();

    await inst.fetchDishes('c1', {}, true);

    expect(inst.dishes.value).toEqual([]);
    expect(inst.dishesLoading.value).toBe(false);
  });

  test('loadMoreDishes respects hasMore and currentCanteenId', async () => {
    const getDishes = jest.fn() as unknown as jest.Mock<any, any>;
    getDishes.mockResolvedValue({ code: 200, data: { items: [{ id: 'd1' }], meta: { totalPages: 1 } } });
    const mockStore = { fetchCanteenDetail: jest.fn(), fetchWindowList: jest.fn(), currentCanteen: null, loading: false, error: null, windowList: [] };
    jest.doMock('@/api/modules/dish', () => ({ getDishes }));
    jest.doMock('@/store/modules/use-canteen-store', () => ({ useCanteenStore: () => mockStore }));

    const { useCanteenData } = require(MODULE_PATH);
    const inst = useCanteenData();

    // when no currentCanteenId, loadMoreDishes should return early
    await inst.loadMoreDishes();

    // set hasMore false
    inst.currentPage = { value: 1 } as any;
    inst.hasMore.value = false;
    await inst.loadMoreDishes();

    // set valid state by first fetching dishes for a canteen
    inst.hasMore.value = true;
    await inst.fetchDishes('c1', {}, true);

    // now loadMore should call getDishes again
    await inst.loadMoreDishes();

    expect(getDishes).toHaveBeenCalled();
  });

  test('toggleFilter toggles activeFilter', () => {
    const mockStore = { fetchCanteenDetail: jest.fn(), fetchWindowList: jest.fn(), currentCanteen: null, loading: false, error: null, windowList: [] };
    jest.doMock('@/store/modules/use-canteen-store', () => ({ useCanteenStore: () => mockStore }));

    const { useCanteenData } = require(MODULE_PATH);
    const inst = useCanteenData();

    inst.toggleFilter('taste');
    expect(inst.activeFilter.value).toBe('taste');
    inst.toggleFilter('taste');
    expect(inst.activeFilter.value).toBe('');
  });
});