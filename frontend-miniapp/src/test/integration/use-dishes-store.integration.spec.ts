/// <reference types="jest" />
import { setActivePinia, createPinia } from 'pinia';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import { getDishes, getDishById } from '@/api/modules/dish';

jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn(),
  getDishById: jest.fn(),
  favoriteDish: jest.fn(),
  unfavoriteDish: jest.fn(),
  uploadDish: jest.fn(),
}));

describe('useDishesStore integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  it('fetchDishes: success should populate dishes and pagination', async () => {
    const store = useDishesStore();

    (getDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [{ id: '1', name: 'Dish 1' }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    });

    await store.fetchDishes({
      filter: {},
      search: { keyword: '' },
      sort: {},
      pagination: { page: 1, pageSize: 10 },
    } as any);

    expect(store.dishes.length).toBe(1);
    expect(store.pagination?.total).toBe(1);
    expect(store.error).toBe(null);
  });

  it('fetchDishes: HTTP 400 should set user-friendly error (not raw HTTP code)', async () => {
    const store = useDishesStore();

    (getDishes as jest.Mock).mockRejectedValue(new Error('HTTP 400'));

    await expect(
      store.fetchDishes({
        filter: {},
        search: { keyword: '' },
        sort: {},
        pagination: { page: 1, pageSize: 10 },
      } as any)
    ).rejects.toThrow('HTTP 400');

    expect(store.error).toBe('网络开小差了，请稍后再试');
  });

  it('fetchDishById: HTTP 500 should set user-friendly error', async () => {
    const store = useDishesStore();

    (getDishById as jest.Mock).mockRejectedValue(new Error('HTTP 500'));

    await expect(store.fetchDishById('dish-1')).rejects.toThrow('HTTP 500');
    expect(store.error).toBe('网络开小差了，请稍后再试');
  });

  it('fetchDishes: business error message should be preserved', async () => {
    const store = useDishesStore();

    (getDishes as jest.Mock).mockResolvedValue({
      code: 400,
      message: '参数错误',
    });

    await expect(
      store.fetchDishes({
        filter: {},
        search: { keyword: '' },
        sort: {},
        pagination: { page: 1, pageSize: 10 },
      } as any)
    ).rejects.toThrow('参数错误');

    expect(store.error).toBe('参数错误');
  });
});
