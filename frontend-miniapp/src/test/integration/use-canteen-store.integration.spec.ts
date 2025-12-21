/// <reference types="jest" />
import { setActivePinia, createPinia } from 'pinia';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
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

describe('useCanteenStore integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
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

  it('fetchCanteenDetail: success should set currentCanteen', async () => {
    const store = useCanteenStore();

    (getCanteenDetail as jest.Mock).mockResolvedValue({
      code: 200,
      data: { id: 'c1', name: 'Canteen 1' },
    });

    await store.fetchCanteenDetail('c1');

    expect(store.currentCanteen?.id).toBe('c1');
  });

  it('fetchWindowList: success should set windowList + pagination', async () => {
    const store = useCanteenStore();

    (getWindowList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'w1', name: 'Window 1' }],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      },
    });

    await store.fetchWindowList('c1', { page: 1, pageSize: 50 });

    expect(store.windowList.length).toBe(1);
    expect(store.pagination.total).toBe(1);
    expect(store.hasWindows).toBe(true);
  });

  it('fetchWindowDetail: success should set currentWindow', async () => {
    const store = useCanteenStore();

    (getWindowDetail as jest.Mock).mockResolvedValue({
      code: 200,
      data: { id: 'w1', name: 'Window 1' },
    });

    await store.fetchWindowDetail('w1');

    expect(store.currentWindow?.id).toBe('w1');
  });

  it('fetchWindowDishes: success should set currentWindowDishes', async () => {
    const store = useCanteenStore();

    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: 'd1', name: 'Dish 1' }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    });

    await store.fetchWindowDishes('w1', { page: 1, pageSize: 10 });

    expect(store.currentWindowDishes.length).toBe(1);
    expect(store.pagination.total).toBe(1);
  });

  it('clearAll: should reset state', () => {
    const store = useCanteenStore();

    store.canteenList = [{ id: 'c1' } as any];
    store.windowList = [{ id: 'w1' } as any];
    store.currentCanteen = { id: 'c1' } as any;
    store.currentWindow = { id: 'w1' } as any;

    store.clearAll();

    expect(store.canteenList).toEqual([]);
    expect(store.windowList).toEqual([]);
    expect(store.currentCanteen).toBeNull();
    expect(store.currentWindow).toBeNull();
  });
});
