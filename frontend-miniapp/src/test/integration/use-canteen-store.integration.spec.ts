/// <reference types="jest" />
import { setActivePinia, createPinia } from 'pinia';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import {
  getCanteenList,
  getCanteenDetail,
  getWindowList,
  getWindowDetail,
  getWindowDishes,
} from '@/api/modules/canteen';

jest.mock('@/api/modules/canteen', () => ({
  getCanteenList: jest.fn(),
  getCanteenDetail: jest.fn(),
  getWindowList: jest.fn(),
  getWindowDetail: jest.fn(),
  getWindowDishes: jest.fn(),
}));
jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn().mockResolvedValue({ code: 200, data: { items: [], meta: { totalPages: 1 } } }),
}));

describe('useCanteenStore integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    (getCanteenDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'c1' } });
    (getWindowList as jest.Mock).mockResolvedValue({ code: 200, data: { items: [] } });
  });

  it('fetchCanteenList: success should set list + pagination', async () => {
    const store = useCanteenStore();

    (getCanteenList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'c1', name: 'Canteen 1' }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    });

    await store.fetchCanteenList({ page: 1, pageSize: 10 });

    expect(store.canteenList.length).toBe(1);
    expect(store.pagination.total).toBe(1);
    expect(store.error).toBe(null);
  });

  it('canteen detail: success should set the page snapshot', async () => {
    const page = useCanteenData();

    (getCanteenDetail as jest.Mock).mockResolvedValue({
      code: 200,
      data: { id: 'c1', name: 'Canteen 1' },
    });

    await page.init('c1');

    expect(page.canteenInfo.value?.id).toBe('c1');
  });

  it('window list: success should set the canteen page options', async () => {
    const page = useCanteenData();

    (getWindowList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'w1', name: 'Window 1' }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      },
    });

    await page.init('c1');

    expect(page.windows.value.length).toBe(1);
    expect(getWindowList).toHaveBeenCalledWith('c1', { page: 1, pageSize: 50 });
  });

  it('window detail: success should set the page snapshot', async () => {
    const page = useWindowData();

    (getWindowDetail as jest.Mock).mockResolvedValue({
      code: 200,
      data: { id: 'w1', name: 'Window 1' },
    });

    await page.fetchWindow('w1');

    expect(page.windowInfo.value?.id).toBe('w1');
  });

  it('window dishes: success should set page dishes and pagination', async () => {
    const page = useWindowData();

    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'd1', name: 'Dish 1' }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    });

    await page.fetchDishes('w1', { page: 1, pageSize: 10 });

    expect(page.dishes.value.length).toBe(1);
    expect(page.hasMore.value).toBe(false);
  });

  it('clearAll: should reset state', () => {
    const store = useCanteenStore();

    store.canteenList = [{ id: 'c1' } as any];

    store.clearAll();

    expect(store.canteenList).toEqual([]);
  });
});
