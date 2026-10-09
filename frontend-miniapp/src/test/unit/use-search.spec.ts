import { useSearch } from '@/pages/search/composables/use-search';
import { getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import { ref } from 'vue';

// Mock dependencies
jest.mock('@/api/modules/canteen');
jest.mock('@/api/modules/dish');
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, userInfo: null }),
}));

describe('useSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCanteenList as jest.Mock).mockReset();
    (getDishes as jest.Mock).mockReset();
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

  it.each([
    [{ canteenId: 'canteen-1' }, { canteenId: ['canteen-1'] }],
    [{ windowId: 'window-1' }, { windowId: ['window-1'] }],
  ])(
    'keeps venue search and pagination within its submitted scope',
    async (initialScope, filter) => {
      (getDishes as jest.Mock)
        .mockResolvedValueOnce({
          code: 200,
          data: { items: [{ id: 'first' }], meta: { page: 1, totalPages: 2 } },
        })
        .mockResolvedValueOnce({
          code: 200,
          data: { items: [{ id: 'second' }], meta: { page: 2, totalPages: 2 } },
        });
      const scope = ref(initialScope);
      const { keyword, search, loadMore } = useSearch(scope);
      keyword.value = '食堂';
      await search();
      expect(getCanteenList).not.toHaveBeenCalled();
      expect(getDishes).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter, search: { keyword: '食堂' } })
      );

      scope.value = { windowId: 'unsubmitted-window' };
      keyword.value = '未提交的输入';
      await loadMore();
      expect(getDishes).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filter,
          search: { keyword: '食堂' },
          pagination: { page: 2, pageSize: 20 },
        })
      );
    }
  );

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

    const { keyword, search, loadMore, searchResults, hasMore } = useSearch();
    keyword.value = '食堂';

    await search();

    expect(getCanteenList).toHaveBeenCalled();
    expect(getDishes).not.toHaveBeenCalled();
    expect(searchResults.value.canteens.length).toBeGreaterThan(0);
    expect(searchResults.value.dishes).toEqual([]);
    expect(hasMore.value).toBe(false);

    await loadMore();
    expect(getDishes).not.toHaveBeenCalled();
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

  it('keeps dish pagination available when the independent canteen scan fails', async () => {
    (getCanteenList as jest.Mock).mockRejectedValue(new Error('食堂目录暂时不可用'));
    (getDishes as jest.Mock)
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: 'first' }], meta: { page: 1, totalPages: 2 } },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: 'second' }], meta: { page: 2, totalPages: 2 } },
      });
    const state = useSearch();
    state.keyword.value = '豆腐';

    await state.search();
    expect(state.hasMore.value).toBe(true);
    await state.loadMore();

    expect((getDishes as jest.Mock).mock.calls.map(([query]) => query.pagination.page)).toEqual([
      1, 2,
    ]);
    expect(state.searchResults.value.dishes.map(dish => dish.id)).toEqual(['first', 'second']);
    expect(state.error.value).toBe('');
    expect(state.canteenError.value).toBe('食堂目录暂时不可用');
    expect(state.hasMore.value).toBe(false);
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
    expect((getDishes as jest.Mock).mock.calls[1][0]).not.toHaveProperty('isSuggestion');
  });

  it('should paginate the submitted search term rather than unsubmitted input edits', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
    });
    (getDishes as jest.Mock)
      .mockResolvedValueOnce({
        code: 200,
        data: {
          items: [{ id: 1, name: 'Old 1' }],
          meta: { page: 1, pageSize: 20, total: 2, totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: {
          items: [{ id: 2, name: 'Old 2' }],
          meta: { page: 2, pageSize: 20, total: 2, totalPages: 2 },
        },
      });

    const { keyword, search, loadMore } = useSearch();
    keyword.value = 'old';
    await search();
    keyword.value = 'new but not submitted';
    await loadMore();

    expect((getDishes as jest.Mock).mock.calls[1][0]).toMatchObject({
      search: { keyword: 'old' },
      pagination: { page: 2, pageSize: 20 },
    });
  });

  it('should ignore a stale rejected search after a newer search succeeds', async () => {
    let rejectOldSearch!: (error: Error) => void;
    const oldSearch = new Promise((_, reject) => {
      rejectOldSearch = reject;
    });

    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
    });
    (getDishes as jest.Mock).mockReturnValueOnce(oldSearch).mockResolvedValueOnce({
      code: 200,
      data: {
        items: [{ id: 2, name: 'New result' }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    });

    const { keyword, search, searchResults, error } = useSearch();
    keyword.value = 'old';
    const firstSearch = search();
    while ((getDishes as jest.Mock).mock.calls.length < 1) {
      await Promise.resolve();
    }

    keyword.value = 'new';
    await search();
    rejectOldSearch(new Error('old request failed'));
    await firstSearch;

    expect(searchResults.value.dishes).toEqual([{ id: 2, name: 'New result' }]);
    expect(error.value).toBe('');
  });

  it('should invalidate an in-flight search when results are cleared', async () => {
    let resolveSearch!: (response: any) => void;
    const pendingSearch = new Promise(resolve => {
      resolveSearch = resolve;
    });

    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
    });
    (getDishes as jest.Mock).mockReturnValue(pendingSearch);

    const { keyword, search, clearSearch, searchResults, hasSearched } = useSearch();
    keyword.value = 'pending';
    const searchPromise = search();
    while ((getDishes as jest.Mock).mock.calls.length < 1) {
      await Promise.resolve();
    }

    clearSearch();
    resolveSearch({
      code: 200,
      data: {
        items: [{ id: 1, name: 'Stale result' }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    });
    await searchPromise;

    expect(searchResults.value.dishes).toEqual([]);
    expect(hasSearched.value).toBe(false);
  });
});
