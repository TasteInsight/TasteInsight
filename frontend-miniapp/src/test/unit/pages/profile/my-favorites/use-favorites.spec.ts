import { jest } from '@jest/globals';

describe('pages/profile/my-favorites/composables/use-favorites.ts', () => {
  const MODULE_PATH = '@/pages/profile/my-favorites/composables/use-favorites';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
  });

  test('fetchFavorites(reset) loads favorites and hasMore', async () => {
    const getMyFavorites = jest.fn().mockResolvedValue({ code: 200, data: { items: [{ dishId: 'd1' }], meta: { totalPages: 1 } } });
    jest.doMock('@/api/modules/user', () => ({ getMyFavorites }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 't' }) }));

    const { useFavorites } = require(MODULE_PATH);
    const inst = useFavorites();

    await inst.fetchFavorites(true);

    expect(getMyFavorites).toHaveBeenCalledTimes(1);
    expect(inst.favoriteItems.value).toEqual([{ dishId: 'd1' }]);
    expect(inst.hasMore.value).toBe(false);
  });

  test('removeFavorite success removes item and shows toast', async () => {
    const unfavoriteDish = jest.fn().mockResolvedValue({ code: 200 });
    jest.doMock('@/api/modules/dish', () => ({ unfavoriteDish }));
    jest.doMock('@/api/modules/user', () => ({ getMyFavorites: jest.fn() }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 't' }) }));

    (global as any).uni = { showToast: jest.fn() };

    const { useFavorites } = require(MODULE_PATH);
    const inst = useFavorites();
    inst.favoriteItems.value = [{ dishId: 'd1' }, { dishId: 'd2' }];

    await inst.removeFavorite('d1');

    expect(unfavoriteDish).toHaveBeenCalledWith('d1');
    expect(inst.favoriteItems.value.find(i => i.dishId === 'd1')).toBeUndefined();
    expect((global as any).uni.showToast).toHaveBeenCalledWith({ title: '已取消收藏', icon: 'success' });
  });

  test('removeFavorite failure shows error toast and keeps list', async () => {
    const unfavoriteDish = jest.fn().mockResolvedValue({ code: 500, message: 'fail' });
    jest.doMock('@/api/modules/dish', () => ({ unfavoriteDish }));
    jest.doMock('@/api/modules/user', () => ({ getMyFavorites: jest.fn() }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 't' }) }));

    (global as any).uni = { showToast: jest.fn() };

    const { useFavorites } = require(MODULE_PATH);
    const inst = useFavorites();
    inst.favoriteItems.value = [{ dishId: 'd1' }];

    await inst.removeFavorite('d1');

    expect(unfavoriteDish).toHaveBeenCalledWith('d1');
    expect(inst.favoriteItems.value.find(i => i.dishId === 'd1')).toBeDefined();
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('fetchFavorites handles errors and sets hasMore false', async () => {
    const getMyFavorites = jest.fn().mockResolvedValue({ code: 400, message: 'bad' });
    jest.doMock('@/api/modules/user', () => ({ getMyFavorites }));
    jest.doMock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ token: 't' }) }));

    (global as any).uni = { showToast: jest.fn() };

    const { useFavorites } = require(MODULE_PATH);
    const inst = useFavorites();

    await inst.fetchFavorites(true);

    expect(inst.error.value).toBe('bad');
    expect(inst.hasMore.value).toBe(false);
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });
});