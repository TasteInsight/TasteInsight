import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { getDishes } from '@/api/modules/dish';
import { ref } from 'vue';

// Mock Store
jest.mock('@/store/modules/use-canteen-store', () => ({
  useCanteenStore: jest.fn(),
}));

// Mock API
jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn(),
}));

describe('useCanteenData', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      currentCanteen: ref(null),
      loading: ref(false),
      error: ref(null),
      windowList: ref([]),
      fetchCanteenDetail: jest.fn().mockResolvedValue(undefined),
      fetchWindowList: jest.fn().mockResolvedValue(undefined),
    };
    (useCanteenStore as unknown as jest.Mock).mockReturnValue(mockStore);
    jest.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    const { init } = useCanteenData();
    const canteenId = '123';

    await init(canteenId);

    expect(mockStore.fetchCanteenDetail).toHaveBeenCalledWith(canteenId);
    expect(mockStore.fetchWindowList).toHaveBeenCalledWith(canteenId, { page: 1, pageSize: 50 });
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
