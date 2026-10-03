jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'user' } }),
}));

import { useWindowData } from '@/pages/window/composables/use-window-data';
import { getWindowDetail, getWindowDishes } from '@/api/modules/canteen';

// Mock API
jest.mock('@/api/modules/canteen', () => ({
  getWindowDishes: jest.fn(),
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

    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [] },
    });

    await init(windowId);

    expect(getWindowDetail).toHaveBeenCalledWith(windowId);
    expect(getWindowDishes).toHaveBeenCalledWith(windowId, expect.anything());
  });

  it('should fetch dishes and update state', async () => {
    const { fetchDishes, dishes, loading } = useWindowData();
    const mockDishes = [{ id: '1', name: 'Dish 1' }];

    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: mockDishes },
    });

    const promise = fetchDishes('123');
    expect(loading.value).toBe(true);

    await promise;

    expect(loading.value).toBe(false);
    expect(dishes.value).toEqual(mockDishes);
  });

  it('should handle fetch dishes error', async () => {
    const { fetchDishes, dishes, error } = useWindowData();

    (getWindowDishes as jest.Mock).mockRejectedValue(new Error('API Error'));

    await fetchDishes('123');

    expect(dishes.value).toEqual([]);
    expect(error.value).toBe('API Error');
  });

  it('should handle fetch window error', async () => {
    const { fetchWindow, error } = useWindowData();

    (getWindowDetail as jest.Mock).mockRejectedValue(new Error('API Error'));

    await fetchWindow('123');

    expect(error.value).toBe('API Error');
  });

  it('should support refresh operations', async () => {
    const { fetchWindow, fetchDishes, beginOperation } = useWindowData();
    const windowId = '123';
    const mockDishes = [{ id: '1', name: 'Dish 1' }];

    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: mockDishes },
    });

    // Test refresh operations (similar to pull-to-refresh)
    const isCurrent = beginOperation();
    await Promise.all([fetchWindow(windowId, isCurrent), fetchDishes(windowId, undefined, undefined, isCurrent)]);

    expect(getWindowDetail).toHaveBeenCalledWith(windowId);
    expect(getWindowDishes).toHaveBeenCalledWith(windowId, expect.anything());
  });
});
