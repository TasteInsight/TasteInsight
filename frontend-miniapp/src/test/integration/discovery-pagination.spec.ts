import { reactive } from 'vue';
import { getDishes } from '@/api/modules/dish';
import { getCanteenList } from '@/api/modules/canteen';
import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import { useSearch } from '@/pages/search/composables/use-search';
import { getWindowDetail } from '@/api/modules/canteen';

const mockUser = reactive({
  sessionVersion: 0,
  userInfo: { settings: { displaySettings: { sortBy: 'price_low' } } },
});
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@/api/modules/dish', () => ({ getDishes: jest.fn() }));
jest.mock('@/api/modules/canteen', () => ({
  getCanteenList: jest.fn(),
  getCanteenDetail: jest.fn(),
  getWindowList: jest.fn(),
  getWindowDetail: jest.fn(),
  getWindowDishes: jest.fn(),
}));

const response = (id: string, page = 1, totalPages = 2) => ({
  code: 200,
  data: { items: [{ id }], meta: { page, totalPages, total: 2, pageSize: 20 } },
});

beforeEach(() => {
  jest.clearAllMocks();
  (getDishes as jest.Mock).mockReset();
  (getCanteenList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { totalPages: 1 } },
  });
  mockUser.userInfo.settings.displaySettings.sortBy = 'price_low';
});

test('canteen pagination retries the failed page and retains its list and sort snapshot', async () => {
  (getDishes as jest.Mock)
    .mockResolvedValueOnce(response('first'))
    .mockRejectedValueOnce(new Error('暂时无法加载'))
    .mockResolvedValueOnce(response('second', 2));
  const page = useCanteenData();
  await page.fetchDishes('canteen');
  await page.loadMoreDishes();
  expect(page.dishes.value.map(dish => dish.id)).toEqual(['first']);
  expect(page.dishesError.value).toBe('暂时无法加载');
  await page.loadMoreDishes();
  expect((getDishes as jest.Mock).mock.calls.map(([query]) => query.pagination.page)).toEqual([
    1, 2, 2,
  ]);
  expect((getDishes as jest.Mock).mock.calls[2][0].sort).toEqual({ field: 'price', order: 'asc' });
  expect(page.dishes.value.map(dish => dish.id)).toEqual(['first', 'second']);
});

test('window lists use the composed dish query and preserve next-page retry', async () => {
  (getDishes as jest.Mock)
    .mockResolvedValueOnce(response('first'))
    .mockResolvedValueOnce({ code: 503, message: '窗口菜品暂时不可用' })
    .mockResolvedValueOnce(response('second', 2));
  const page = useWindowData();
  await page.fetchDishes('window');
  expect(getDishes).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filter: { windowId: ['window'], includeOffline: false },
      sort: { field: 'price', order: 'asc' },
    })
  );
  await page.loadMoreDishes('window');
  expect(page.dishes.value.map(dish => dish.id)).toEqual(['first']);
  expect(page.error.value).toBe('窗口菜品暂时不可用');
  await page.loadMoreDishes('window');
  expect((getDishes as jest.Mock).mock.calls.map(([query]) => query.pagination.page)).toEqual([
    1, 2, 2,
  ]);
});

test('search append errors are visible without erasing results or advancing the cursor', async () => {
  (getDishes as jest.Mock)
    .mockResolvedValueOnce(response('first'))
    .mockResolvedValueOnce({ code: 503, message: '搜索暂时不可用' })
    .mockResolvedValueOnce(response('second', 2));
  const page = useSearch();
  page.keyword.value = '豆腐';
  await page.search();
  expect(getDishes).toHaveBeenLastCalledWith(
    expect.objectContaining({ sort: { field: 'price', order: 'asc' } })
  );
  await page.loadMore();
  expect(page.loadMoreError.value).toBe('搜索暂时不可用');
  expect(page.searchResults.value.dishes.map(dish => dish.id)).toEqual(['first']);
  await page.loadMore();
  expect((getDishes as jest.Mock).mock.calls.map(([query]) => query.pagination.page)).toEqual([
    1, 2, 2,
  ]);
});

test('an older window initializer cannot start a new dish query after sorting has changed', async () => {
  let resolveHeader!: (value: unknown) => void;
  let resolveDishes!: (value: unknown) => void;
  (getWindowDetail as jest.Mock).mockReturnValueOnce(
    new Promise(resolve => {
      resolveHeader = resolve;
    })
  );
  (getDishes as jest.Mock).mockReturnValueOnce(
    new Promise(resolve => {
      resolveDishes = resolve;
    })
  );
  const page = useWindowData();
  const initializing = page.init('window');
  mockUser.userInfo.settings.displaySettings.sortBy = 'newest';
  const refreshing = page.refreshPreferredSort();
  resolveHeader({ code: 200, data: { id: 'window', name: '素食窗口' } });
  await initializing;
  expect(getDishes).toHaveBeenCalledTimes(1);
  expect(page.loading.value).toBe(true);
  resolveDishes(response('newest'));
  await refreshing;
  expect(page.dishes.value.map(dish => dish.id)).toEqual(['newest']);
  expect(page.loading.value).toBe(false);
});

test('changing default sorting invalidates pending append and retains content until replacement', async () => {
  let resolveOld!: (value: unknown) => void;
  let resolveNew!: (value: unknown) => void;
  (getDishes as jest.Mock)
    .mockResolvedValueOnce(response('first'))
    .mockReturnValueOnce(
      new Promise(resolve => {
        resolveOld = resolve;
      })
    )
    .mockReturnValueOnce(
      new Promise(resolve => {
        resolveNew = resolve;
      })
    );
  const page = useCanteenData();
  await page.fetchDishes('canteen');
  const append = page.loadMoreDishes();
  mockUser.userInfo.settings.displaySettings.sortBy = 'newest';
  const refresh = page.refreshPreferredSort();
  expect(page.dishes.value.map(dish => dish.id)).toEqual(['first']);
  resolveOld(response('stale', 2));
  await append;
  expect(page.dishesLoading.value).toBe(true);
  expect(page.dishes.value.map(dish => dish.id)).toEqual(['first']);
  resolveNew(response('fresh'));
  await refresh;
  expect(page.dishes.value.map(dish => dish.id)).toEqual(['fresh']);
  expect(getDishes).toHaveBeenLastCalledWith(
    expect.objectContaining({
      sort: { field: 'createdAt', order: 'desc' },
      pagination: { page: 1, pageSize: 20 },
    })
  );
});
