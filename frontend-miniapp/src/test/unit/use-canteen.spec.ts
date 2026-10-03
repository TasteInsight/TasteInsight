jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'user' } }),
}));

import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { getCanteenDetail, getWindowList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
jest.mock('@/api/modules/canteen', () => ({ getCanteenDetail: jest.fn(), getWindowList: jest.fn() }));

// Mock API
jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn(),
}));

describe('useCanteenData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCanteenDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: '123' } });
    (getWindowList as jest.Mock).mockResolvedValue({ code: 200, data: { items: [] } });
  });

  it('should initialize correctly', async () => {
    const { init } = useCanteenData();
    const canteenId = '123';

    await init(canteenId);

    expect(getCanteenDetail).toHaveBeenCalledWith(canteenId);
    expect(getWindowList).toHaveBeenCalledWith(canteenId, { page: 1, pageSize: 50 });
    expect(getDishes).toHaveBeenCalled();
  });

  it('should fetch dishes and update state', async () => {
    const { fetchDishes, dishes } = useCanteenData();
    const mockDishes = [{ id: '1', name: 'Dish 1' }];

    (getDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: mockDishes },
    });

    await fetchDishes('123');

    expect(dishes.value).toEqual(mockDishes);
  });

  it('should handle fetch dishes error', async () => {
    const { fetchDishes, dishes } = useCanteenData();

    (getDishes as jest.Mock).mockRejectedValue(new Error('Error'));

    await fetchDishes('123');

    expect(dishes.value).toEqual([]); // Should remain empty or previous state
  });

  it('should toggle filters', () => {
    const { toggleFilter, activeFilter } = useCanteenData();

    expect(activeFilter.value).toBe('');

    toggleFilter('price');
    expect(activeFilter.value).toBe('price');

    toggleFilter('price');
    expect(activeFilter.value).toBe('');

    toggleFilter('rating');
    expect(activeFilter.value).toBe('rating');
  });
});
