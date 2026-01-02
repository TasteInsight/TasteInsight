import { setActivePinia, createPinia } from 'pinia';

jest.mock('@/api/modules/canteen');
import * as canteenModule from '@/api/modules/canteen';
const { getCanteenList, getCanteenDetail, getWindowList, getWindowDetail, getWindowDishes } = canteenModule as any;

import { useCanteenStore } from '@/store/modules/use-canteen-store';

describe('store/modules/use-canteen-store', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    setActivePinia(createPinia());
  });

  test('fetchCanteenList sets list and pagination on success', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({ code: 200, data: { items: [{ id: 'c1' }], meta: { totalPages: 3, page: 1, total: 6, pageSize: 9 } } });
    const store = useCanteenStore();
    await store.fetchCanteenList({ page: 1 } as any);
    expect(store.canteenList.length).toBe(1);
    expect(store.pagination.totalPages).toBe(3);
    expect(store.loading).toBe(false);
  });

  test('fetchCanteenList throws and sets error on failure', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({ code: 500, message: 'Fail' });
    const store = useCanteenStore();
    await expect(store.fetchCanteenList()).rejects.toBeTruthy();
    expect(store.error).toBeDefined();
  });

  test('loadMoreCanteenList appends items and respects totalPages', async () => {
    (getCanteenList as jest.Mock)
      .mockResolvedValueOnce({ code: 200, data: { items: [{ id: 'c1' }], meta: { totalPages: 2, page: 1, total: 2, pageSize: 9 } } })
      .mockResolvedValueOnce({ code: 200, data: { items: [{ id: 'c2' }], meta: { totalPages: 2, page: 2, total: 2, pageSize: 9 } } });

    const store = useCanteenStore();
    await store.fetchCanteenList();
    expect(store.canteenList.length).toBe(1);

    // load more should append
    await store.loadMoreCanteenList();
    expect(store.canteenList.map(c => c.id)).toEqual(['c1', 'c2']);

    // now page == totalPages, further calls should return immediately
    await store.loadMoreCanteenList();
    expect(getCanteenList).toHaveBeenCalledTimes(2);
  });

  test('fetchCanteenDetail sets currentCanteen and handles failure', async () => {
    (getCanteenDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'c1', name: 'C' } });
    const store = useCanteenStore();
    await store.fetchCanteenDetail('c1');
    expect(store.currentCanteen?.id).toBe('c1');

    (getCanteenDetail as jest.Mock).mockResolvedValue({ code: 400, message: 'Bad' });
    await expect(store.fetchCanteenDetail('c2')).rejects.toBeTruthy();
  });

  test('fetchWindowList and fetchWindowDetail set windowList/currentWindow', async () => {
    (getWindowList as jest.Mock).mockResolvedValue({ code: 200, data: { items: [{ id: 'w1' }], meta: { totalPages: 1, total: 1, page: 1, pageSize: 9 } } });
    (getWindowDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'w1', name: 'W' } });

    const store = useCanteenStore();
    await store.fetchWindowList('c1');
    expect(store.windowList.length).toBe(1);

    await store.fetchWindowDetail('w1');
    expect(store.currentWindow?.id).toBe('w1');

    (getWindowDetail as jest.Mock).mockResolvedValue({ code: 500 });
    await expect(store.fetchWindowDetail('bad')).rejects.toBeTruthy();
  });

  test('fetchWindowDishes sets dishes and pagination and handles errors', async () => {
    (getWindowDishes as jest.Mock).mockResolvedValue({ code: 200, data: { items: [{ id: 'd1' }], meta: { totalPages: 1, total: 1, page: 1, pageSize: 9 } } });
    const store = useCanteenStore();

    await store.fetchWindowDishes('w1');
    expect(store.currentWindowDishes.length).toBe(1);

    (getWindowDishes as jest.Mock).mockResolvedValue({ code: 400 });
    await expect(store.fetchWindowDishes('w2')).rejects.toBeTruthy();
  });

  test('clearCurrentCanteen/clearCurrentWindow/clearAll reset state', () => {
    const store = useCanteenStore();
    store.currentCanteen = { id: 'c' } as any;
    store.currentWindow = { id: 'w' } as any;
    store.currentWindowDishes = [{ id: 'd1' } as any];
    store.canteenList = [{ id: 'c1' } as any];

    store.clearCurrentCanteen();
    expect(store.currentCanteen).toBeNull();

    store.clearCurrentWindow();
    expect(store.currentWindow).toBeNull();
    expect(store.currentWindowDishes.length).toBe(0);

    store.clearAll();
    expect(store.canteenList.length).toBe(0);
    expect(store.pagination.page).toBe(1);
  });
});