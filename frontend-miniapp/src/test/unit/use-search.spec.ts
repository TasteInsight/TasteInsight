import { useSearch } from '@/pages/search/composables/use-search';
import { getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';

// Mock dependencies
jest.mock('@/api/modules/canteen');
jest.mock('@/api/modules/dish');

describe('useSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct state', () => {
    const { keyword, searchResults, loading, error, hasSearched, hasResults } = useSearch();

    expect(keyword.value).toBe('');
    expect(searchResults.value).toEqual({ canteens: [], windows: [], dishes: [] });
    expect(loading.value).toBe(false);
    expect(error.value).toBe('');
    expect(hasSearched.value).toBe(false);
    expect(hasResults.value).toBe(false);
  });

  it('should not search if keyword is empty', async () => {
    const { keyword, search } = useSearch();
    keyword.value = '   ';

    await search();

    expect(getCanteenList).not.toHaveBeenCalled();
    expect(getDishes).not.toHaveBeenCalled();
  });

  it('should return canteen results first when canteen name matches', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [
          { id: 'c1', name: '一食堂' },
          { id: 'c2', name: '二食堂' },
        ],
        meta: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
      },
    });

    const { keyword, search, searchResults } = useSearch();
    keyword.value = '食堂';

    await search();

    expect(getCanteenList).toHaveBeenCalled();
    expect(getDishes).not.toHaveBeenCalled();
    expect(searchResults.value.canteens.length).toBeGreaterThan(0);
    expect(searchResults.value.dishes).toEqual([]);
  });

  it('should search successfully', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'c1', name: '不匹配的食堂' }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      },
    });

    const mockDishes = [{ id: 1, name: 'Dish 1' }];
    const mockResponse = {
      code: 200,
      data: {
        items: mockDishes,
        total: 1,
      },
    };
    (getDishes as jest.Mock).mockResolvedValue(mockResponse);

    const { keyword, search, searchResults, loading, hasSearched, hasResults } = useSearch();
    keyword.value = 'test';

    const searchPromise = search();
    expect(loading.value).toBe(true);

    await searchPromise;

    expect(loading.value).toBe(false);
    expect(hasSearched.value).toBe(true);
    expect(searchResults.value.dishes).toEqual(mockDishes);
    expect(hasResults.value).toBe(true);
    expect(getDishes).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { keyword: 'test' },
      })
    );
  });

  it('should handle search error from API response', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'c1', name: '不匹配的食堂' }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      },
    });

    const mockResponse = {
      code: 500,
      message: 'Server Error',
    };
    (getDishes as jest.Mock).mockResolvedValue(mockResponse);

    const { keyword, search, error } = useSearch();
    keyword.value = 'test';

    await search();

    expect(error.value).toBe('Server Error');
  });

  it('should handle search exception', async () => {
    const errorMsg = 'Network Error';
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'c1', name: '不匹配的食堂' }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      },
    });
    (getDishes as jest.Mock).mockRejectedValue(new Error(errorMsg));

    const { keyword, search, error, searchResults } = useSearch();
    keyword.value = 'test';

    await search();

    expect(error.value).toBe(errorMsg);
    expect(searchResults.value.dishes).toEqual([]);
  });

  it('should clear search results', () => {
    const { keyword, searchResults, hasSearched, clearSearch } = useSearch();

    // Set some state
    keyword.value = 'test';
    searchResults.value.dishes = [{ id: 1, name: 'Dish 1' }] as any;
    hasSearched.value = true;

    clearSearch();

    expect(keyword.value).toBe('');
    expect(searchResults.value.dishes).toEqual([]);
    expect(hasSearched.value).toBe(false);
  });

  it('should navigate to add dish page', () => {
    const { keyword, goToAddDish } = useSearch();
    keyword.value = 'test dish';

    // Mock uni.navigateTo
    (global as any).uni = {
      navigateTo: jest.fn(),
    } as any;

    goToAddDish();

    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/add-dish/index?keyword=test%20dish',
    });
  });

  it('should set pagination meta after search', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'c1', name: '不匹配的食堂' }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 2 },
      },
    });

    const mockDishes = [{ id: 1, name: 'Dish 1' }];
    const mockResponse = {
      code: 200,
      data: {
        items: mockDishes,
        meta: { page: 1, pageSize: 20, total: 30, totalPages: 2 },
      },
    };
    (getDishes as jest.Mock).mockResolvedValue(mockResponse);

    const { keyword, search, page, hasMore } = useSearch();
    keyword.value = 'test';

    await search();

    expect(page.value).toBe(1);
    expect(hasMore.value).toBe(true);
  });

  it('should append results on loadMore and update pagination', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'c1', name: '不匹配的食堂' }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 2 },
      },
    });

    const page1 = {
      code: 200,
      data: {
        items: [{ id: 1, name: 'Dish 1' }],
        meta: { page: 1, pageSize: 20, total: 2, totalPages: 2 },
      },
    };

    const page2 = {
      code: 200,
      data: {
        items: [{ id: 2, name: 'Dish 2' }],
        meta: { page: 2, pageSize: 20, total: 2, totalPages: 2 },
      },
    };

    // first call returns page1, second call returns page2
    (getDishes as jest.Mock).mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const { keyword, search, loadMore, searchResults, page, hasMore } = useSearch();
    keyword.value = 'test';

    await search();
    expect(searchResults.value.dishes.length).toBe(1);
    expect(page.value).toBe(1);
    expect(hasMore.value).toBe(true);

    await loadMore();

    expect(searchResults.value.dishes.length).toBe(2);
    expect(page.value).toBe(2);
    expect(hasMore.value).toBe(false);
  });
});
