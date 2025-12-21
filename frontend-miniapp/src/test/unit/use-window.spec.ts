import { useWindowData } from '@/pages/window/composables/use-window-data';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { getWindowDishes } from '@/api/modules/canteen';
import { ref } from 'vue';

// Mock Store
jest.mock('@/store/modules/use-canteen-store', () => ({
  useCanteenStore: jest.fn(),
}));

// Mock API
jest.mock('@/api/modules/canteen', () => ({
  getWindowDishes: jest.fn(),
}));

describe('useWindowData', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      currentWindow: ref(null),
      error: ref(null),
      fetchWindowDetail: jest.fn().mockResolvedValue(undefined),
    };
    (useCanteenStore as unknown as jest.Mock).mockReturnValue(mockStore);
    jest.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    const { init } = useWindowData();
    const windowId = '123';

    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: [] },
    });

    await init(windowId);

    expect(mockStore.fetchWindowDetail).toHaveBeenCalledWith(windowId);
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
    
    mockStore.fetchWindowDetail.mockRejectedValue(new Error('Store Error'));

    await fetchWindow('123');

    expect(error.value).toBe('Store Error');
  });

  it('should support refresh operations', async () => {
    const { fetchWindow, fetchDishes } = useWindowData();
    const windowId = '123';
    const mockDishes = [{ id: '1', name: 'Dish 1' }];

    (getWindowDishes as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: mockDishes },
    });

    // Test refresh operations (similar to pull-to-refresh)
    await Promise.all([
      fetchWindow(windowId),
      fetchDishes(windowId)
    ]);

    expect(mockStore.fetchWindowDetail).toHaveBeenCalledWith(windowId);
    expect(getWindowDishes).toHaveBeenCalledWith(windowId, expect.anything());
  });
});
