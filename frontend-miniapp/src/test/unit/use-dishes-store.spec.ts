/// <reference types="jest" />
import { setActivePinia, createPinia } from 'pinia';

const mockShowToast = jest.fn();
(global as any).uni = { showToast: mockShowToast } as any;

jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn(),
  getDishById: jest.fn(),
  favoriteDish: jest.fn(),
  unfavoriteDish: jest.fn(),
  uploadDish: jest.fn(),
}));

import { useDishesStore } from '@/store/modules/use-dishes-store';
import { getDishes, getDishById, favoriteDish, unfavoriteDish, uploadDish } from '@/api/modules/dish';

describe('useDishesStore actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  test('fetchDishes sets dishes and pagination on success', async () => {
    (getDishes as jest.Mock).mockResolvedValue({ code: 200, data: { items: [{ id: 'd1' }], meta: { totalPages: 2 } } });
    const store = useDishesStore();
    await store.fetchDishes({ page: 1 } as any);
    expect(store.dishes.length).toBe(1);
    expect(store.pagination).toHaveProperty('totalPages', 2);
    expect(store.loading).toBe(false);
  });

  test('fetchDishes append merges items', async () => {
    (getDishes as jest.Mock).mockResolvedValue({ code: 200, data: { items: [{ id: 'd2' }], meta: { totalPages: 2 } } });
    const store = useDishesStore();
    store.dishes = [{ id: 'd1' } as any];
    await store.fetchDishes({ page: 2 } as any, { append: true });
    expect(store.dishes.map(d => d.id)).toEqual(['d1', 'd2']);
  });

  test('fetchDishes throws and sets error on failure', async () => {
    (getDishes as jest.Mock).mockResolvedValue({ code: 500, message: 'Bad' });
    const store = useDishesStore();
    await expect(store.fetchDishes({ page: 1 } as any)).rejects.toBeTruthy();
    expect(store.error).toBeDefined();
  });

  test('fetchDishById success and failure set currentDish or throw', async () => {
    (getDishById as jest.Mock).mockResolvedValueOnce({ code: 200, data: { id: 'd1' } });
    const store = useDishesStore();
    await store.fetchDishById('d1');
    expect(store.currentDish).toHaveProperty('id', 'd1');

    (getDishById as jest.Mock).mockResolvedValueOnce({ code: 500, message: 'Err' });
    await expect(store.fetchDishById('d1')).rejects.toBeTruthy();
  });

  test('favorite/unfavorite return boolean and show toast', async () => {
    (favoriteDish as jest.Mock).mockResolvedValue({ code: 200 });
    (unfavoriteDish as jest.Mock).mockResolvedValue({ code: 200 });

    const store = useDishesStore();
    const ok1 = await store.favorite('d1');
    expect(ok1).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '收藏成功' }));

    const ok2 = await store.unfavorite('d1');
    expect(ok2).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已取消收藏' }));

    (favoriteDish as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    const ok3 = await store.favorite('d1');
    expect(ok3).toBe(false);
  });

  test('upload success returns data and failure returns null', async () => {
    (uploadDish as jest.Mock).mockResolvedValueOnce({ code: 201, data: { id: 'dnew' } });
    const store = useDishesStore();
    const res = await store.upload({ name: 'X' } as any);
    expect(res).toHaveProperty('id', 'dnew');

    (uploadDish as jest.Mock).mockResolvedValueOnce({ code: 500, message: 'bad' });
    const res2 = await store.upload({} as any);
    expect(res2).toBeNull();
  });

  test('clearCurrentDish sets currentDish to null', () => {
    const store = useDishesStore();
    store.currentDish = { id: 'd1' } as any;
    store.clearCurrentDish();
    expect(store.currentDish).toBeNull();
  });
});