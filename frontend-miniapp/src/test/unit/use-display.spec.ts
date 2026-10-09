import { useDisplay, SORT_VALUES } from '@/pages/settings/composables/use-display';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// Mock Store

// Mock API
jest.mock('@/api/modules/user', () => ({
  updateUserProfile: jest.fn(),
}));

// Mock Vue onMounted
jest.mock('vue', () => {
  const originalVue = jest.requireActual('vue');
  return {
    ...originalVue,
    onMounted: jest.fn(fn => fn()),
  };
});

// Mock global.uni
(global as any).uni = {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  showToast: jest.fn(),
  navigateBack: jest.fn(),
};

describe('useDisplay', () => {
  let mockStore: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockStore = reactive({
      userInfo: {
        settings: {
          displaySettings: {
            showCalories: false,
            showNutrition: false,
            sortBy: 'popularity',
          },
        },
      },
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
    });
    const actualStore = useUserStore();
    actualStore.userInfo = mockStore.userInfo;
    actualStore.fetchProfileAction = mockStore.fetchProfileAction;
    actualStore.token = 'test-token';
    mockStore = actualStore;
    jest.clearAllMocks();
  });

  it('should load display settings on mount', async () => {
    const { form, loading } = useDisplay();

    expect(loading.value).toBe(true);
    await new Promise(process.nextTick);

    expect(mockStore.fetchProfileAction).toHaveBeenCalled();
    expect(form.showCalories).toBe(false);
    expect(form.showNutrition).toBe(false);
    expect(form.sortByIndex).toBe(SORT_VALUES.indexOf('popularity'));
    expect(loading.value).toBe(false);
  });

  it('should handle change events', async () => {
    const { form, onShowCaloriesChange, onShowNutritionChange, onSortChange } = useDisplay();
    await new Promise(process.nextTick);

    // Switch change (event object)
    onShowCaloriesChange({ detail: { value: true } });
    expect(form.showCalories).toBe(true);

    // Switch change (boolean)
    onShowNutritionChange(true);
    expect(form.showNutrition).toBe(true);

    // Picker change (event object)
    onSortChange({ detail: { value: 2 } });
    expect(form.sortByIndex).toBe(2);
  });

  it('should handle save success', async () => {
    const { form, handleSave, saving } = useDisplay();
    await new Promise(process.nextTick);

    form.showCalories = true;
    form.sortByIndex = 0;

    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 200,
      data: { settings: { displaySettings: { showCalories: true, sortBy: 'rating' } } },
    });

    const result = await handleSave();

    expect(saving.value).toBe(false);
    expect(result).toBe(true);
    expect(updateUserProfile).toHaveBeenCalledWith({
      settings: {
        displaySettings: {
          showCalories: true,
          showNutrition: false,
          sortBy: 'rating',
        },
      },
    });
    expect(uni.setStorageSync).toHaveBeenCalledWith('userInfo', JSON.stringify(mockStore.userInfo));
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '保存成功' }));
  });

  it('should handle save failure', async () => {
    const { handleSave, saving } = useDisplay();
    await new Promise(process.nextTick);

    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 500,
      message: 'Server Error',
    });

    const result = await handleSave();

    expect(saving.value).toBe(false);
    expect(result).toBe(false);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Server Error' }));
  });
});
