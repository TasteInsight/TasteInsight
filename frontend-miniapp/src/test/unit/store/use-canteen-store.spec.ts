import { setActivePinia, createPinia } from 'pinia';

jest.mock('@/api/modules/canteen');
import * as canteenModule from '@/api/modules/canteen';
const { getCanteenList, getCanteenDetail, getWindowList, getWindowDetail, getWindowDishes } =
  canteenModule as any;

import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useWindowData } from '@/pages/window/composables/use-window-data';
jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn().mockResolvedValue({ code: 200, data: { items: [], meta: { totalPages: 1 } } }),
}));

describe('store/modules/use-canteen-store', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    setActivePinia(createPinia());
    getCanteenDetail.mockResolvedValue({ code: 200, data: { id: 'c1' } });
    getWindowList.mockResolvedValue({ code: 200, data: { items: [] } });
  });

  test('fetchCanteenList sets list and pagination on success', async () => {
    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1' }], meta: { totalPages: 3, page: 1, total: 6, pageSize: 9 } },
    });
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
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: 'c1' }], meta: { totalPages: 2, page: 1, total: 2, pageSize: 9 } },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: 'c2' }], meta: { totalPages: 2, page: 2, total: 2, pageSize: 9 } },
      });

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

  test('canteen page owns its detail and handles failure', async () => {
    (getCanteenDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'c1', name: 'C' } });
    const page = useCanteenData();
    await page.init('c1');
    expect(page.canteenInfo.value?.id).toBe('c1');

    (getCanteenDetail as jest.Mock).mockResolvedValue({ code: 400, message: 'Bad' });
    await expect(page.init('c2')).resolves.toBe(false);
    expect(page.error.value).toBe('Bad');
  });

  test('canteen and window pages own their window snapshots', async () => {
    (getWindowList as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'w1' }], meta: { totalPages: 1, total: 1, page: 1, pageSize: 9 } },
    });
    (getWindowDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'w1', name: 'W' } });

    const canteen = useCanteenData();
    await canteen.init('c1');
    expect(canteen.windows.value.length).toBe(1);

    const window = useWindowData();
    await window.fetchWindow('w1');
    expect(window.windowInfo.value?.id).toBe('w1');

    (getWindowDetail as jest.Mock).mockResolvedValue({ code: 500 });
    await expect(window.fetchWindow('bad')).resolves.toBe(false);
    expect(window.error.value).toBe('获取窗口详情失败');
  });

  test('window page sets dishes and pagination and handles errors', async () => {
    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'd1' }], meta: { totalPages: 1, total: 1, page: 1, pageSize: 9 } },
    });
    const page = useWindowData();

    await page.fetchDishes('w1');
    expect(page.dishes.value.length).toBe(1);
    expect(page.hasMore.value).toBe(false);

    (getWindowDishes as jest.Mock).mockResolvedValue({ code: 400 });
    await expect(page.fetchDishes('w2')).resolves.toBe(false);
    expect(page.error.value).toBe('获取菜品列表失败');
  });

  test('clearAll resets shared list state', () => {
    const store = useCanteenStore();
    store.canteenList = [{ id: 'c1' } as any];

    store.clearAll();
    expect(store.canteenList.length).toBe(0);
    expect(store.pagination.page).toBe(1);
  });
});
