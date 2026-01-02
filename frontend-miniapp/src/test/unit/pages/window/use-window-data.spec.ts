import { nextTick } from 'vue';

jest.mock('@/api/modules/canteen');
jest.mock('@/store/modules/use-canteen-store');

import { getWindowDishes } from '@/api/modules/canteen';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import { useCanteenStore as _useCanteenStore } from '@/store/modules/use-canteen-store';

const mockedGetWindowDishes = getWindowDishes as jest.MockedFunction<typeof getWindowDishes>;
const mockedUseCanteenStore = _useCanteenStore as jest.MockedFunction<typeof _useCanteenStore>;

describe('useWindowData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchWindow handles store fetch error and sets local error', async () => {
    const fakeStore = {
      fetchWindowDetail: jest.fn().mockRejectedValue(new Error('store fail')),
      currentWindow: null,
      error: '',
    } as any;

    mockedUseCanteenStore.mockReturnValue(fakeStore);

    const { fetchWindow, error } = useWindowData();

    await fetchWindow('w1');

    expect(fakeStore.fetchWindowDetail).toHaveBeenCalledWith('w1');
    expect(error.value).toBe('store fail');
  });

  test('fetchDishes success sets dishes, page and hasMore; toggles loading flags', async () => {
    const items = [{ id: 'd1' }, { id: 'd2' }];
    mockedGetWindowDishes.mockResolvedValueOnce({ code: 200, data: { items, meta: { page: 1, totalPages: 2 } } } as any);
    mockedUseCanteenStore.mockReturnValue({ currentWindow: null, fetchWindowDetail: jest.fn(), error: '' } as any);

    const { fetchDishes, dishes, loading, loadingMore, hasMore } = useWindowData();

    expect(loading.value).toBe(false);
    const p = fetchDishes('w1', { page: 1, pageSize: 20 });
    // loading should be true during call
    expect(loading.value).toBe(true);
    await p;
    expect(dishes.value).toEqual(items);
    expect(hasMore.value).toBe(true);
    expect(loading.value).toBe(false);
    expect(loadingMore.value).toBe(false);
  });

  test('fetchDishes append true appends items and toggles loadingMore', async () => {
    const first = [{ id: 'a' }];
    const next = [{ id: 'b' }];

    mockedGetWindowDishes.mockResolvedValueOnce({ code: 200, data: { items: first, meta: { page: 1, totalPages: 2 } } } as any);
    mockedUseCanteenStore.mockReturnValue({ currentWindow: null, fetchWindowDetail: jest.fn(), error: '' } as any);

    const composable = useWindowData();
    await composable.fetchDishes('w1', { page: 1, pageSize: 20 });

    mockedGetWindowDishes.mockResolvedValueOnce({ code: 200, data: { items: next, meta: { page: 2, totalPages: 2 } } } as any);
    const promise = composable.fetchDishes('w1', { page: 2, pageSize: 20 }, { append: true });
    expect(composable.loadingMore.value).toBe(true);
    await promise;
    expect(composable.dishes.value).toEqual([...first, ...next]);
    expect(composable.loadingMore.value).toBe(false);
    expect(composable.hasMore.value).toBe(false);
  });

  test('fetchDishes failure sets localError and resets flags', async () => {
    mockedGetWindowDishes.mockRejectedValueOnce(new Error('api fail'));
    mockedUseCanteenStore.mockReturnValue({ currentWindow: null, fetchWindowDetail: jest.fn(), error: '' } as any);

    const { fetchDishes, error, loading, loadingMore } = useWindowData();

    await fetchDishes('w1');

    expect(error.value).toBe('api fail');
    expect(loading.value).toBe(false);
    expect(loadingMore.value).toBe(false);
  });

  test('loadMoreDishes returns early when loading or no more', async () => {
    mockedUseCanteenStore.mockReturnValue({ currentWindow: null, fetchWindowDetail: jest.fn(), error: '' } as any);
    mockedGetWindowDishes.mockResolvedValue({ code: 200, data: { items: [], meta: { page: 1, totalPages: 1 } } } as any);

    const comp = useWindowData();
    // case: loading prevents
    comp.loading.value = true;
    await comp.loadMoreDishes('w1');
    expect(mockedGetWindowDishes).not.toHaveBeenCalled();

    comp.loading.value = false;
    // case: no more prevents
    comp.hasMore.value = false;
    await comp.loadMoreDishes('w1');
    expect(mockedGetWindowDishes).not.toHaveBeenCalled();
  });
});