jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'user' } }),
}));

import { useWindowData } from '@/pages/window/composables/use-window-data';
import { getWindowDetail } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
jest.mock('@/api/modules/dish', () => ({ getDishes: jest.fn() }));

// Mock API
jest.mock('@/api/modules/canteen', () => ({
  getWindowDetail: jest.fn(),
}));

describe('useWindowData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getWindowDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: '123' } });
  });

  it('should initialize correctly', async () => {
    const { init } = useWindowData();
    const windowId = '123';

    (getDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
    });

    await init(windowId);

    expect(getWindowDetail).toHaveBeenCalledWith(windowId);
    expect(getDishes).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ windowId: [windowId] }) })
    );
  });

  it('should fetch dishes and update state', async () => {
    const { fetchDishes, dishes, loading, error } = useWindowData();
    const mockDishes = [{ id: '1', name: 'Dish 1' }];

    (getDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: mockDishes, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
    });

    const promise = fetchDishes('123');
    expect(loading.value).toBe(true);

    await promise;

    expect(loading.value).toBe(false);
    expect(dishes.value).toEqual(mockDishes);
    expect(error.value).toBe('');
  });

  it('should handle fetch dishes error', async () => {
    const { fetchDishes, dishes, error } = useWindowData();

    (getDishes as jest.Mock).mockRejectedValue(new Error('API Error'));

    await fetchDishes('123');

    expect(dishes.value).toEqual([]);
    expect(error.value).toBe('API Error');
  });

  it('should handle fetch window error', async () => {
    const { fetchWindow, headerError } = useWindowData();

    (getWindowDetail as jest.Mock).mockRejectedValue(new Error('API Error'));

    await fetchWindow('123');

    expect(headerError.value).toBe('API Error');
  });

  it('should support refresh operations', async () => {
    const { fetchWindow, fetchDishes, beginOperation } = useWindowData();
    const windowId = '123';
    const mockDishes = [{ id: '1', name: 'Dish 1' }];

    (getDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: mockDishes, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
    });

    // Test refresh operations (similar to pull-to-refresh)
    const isCurrent = beginOperation();
    await Promise.all([
      fetchWindow(windowId, isCurrent),
      fetchDishes(windowId, undefined, undefined, isCurrent),
    ]);

    expect(getWindowDetail).toHaveBeenCalledWith(windowId);
    expect(getDishes).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ windowId: [windowId] }) })
    );
  });
});
