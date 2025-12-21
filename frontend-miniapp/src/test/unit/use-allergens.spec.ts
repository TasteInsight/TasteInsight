import { useAllergens } from '@/pages/settings/composables/use-allergens';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import { reactive, ref } from 'vue';

// Mock Store
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));

// Mock API
jest.mock('@/api/modules/user', () => ({
  updateUserProfile: jest.fn(),
}));

// Mock Vue onMounted
jest.mock('vue', () => {
  const originalVue = jest.requireActual('vue');
  return {
    ...originalVue,
    onMounted: jest.fn((fn) => fn()),
  };
});

// Mock global.uni
(global as any).uni = {
  showToast: jest.fn(),
  navigateBack: jest.fn(),
};

describe('useAllergens', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = reactive({
      userInfo: {
        allergens: ['Peanut', 'Milk'],
      },
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
      updateLocalUserInfo: jest.fn(),
    });
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockStore);
    jest.clearAllMocks();
  });

  it('should load allergens on mount', async () => {
    const { form, loading } = useAllergens();
    
    expect(loading.value).toBe(true);
    await new Promise(process.nextTick);

    expect(mockStore.fetchProfileAction).toHaveBeenCalled();
    expect(form.allergens).toBe('Peanut, Milk');
    expect(loading.value).toBe(false);
  });

  it('should toggle allergens', async () => {
    const { form, toggleAllergen, isSelected } = useAllergens();
    await new Promise(process.nextTick);

    // Initial state
    expect(isSelected('Peanut')).toBe(true);
    expect(isSelected('Egg')).toBe(false);

    // Toggle off
    toggleAllergen('Peanut');
    expect(form.allergens).not.toContain('Peanut');
    expect(isSelected('Peanut')).toBe(false);

    // Toggle on
    toggleAllergen('Egg');
    expect(form.allergens).toContain('Egg');
    expect(isSelected('Egg')).toBe(true);
  });

  it('should handle save success', async () => {
    const { form, handleSave, saving } = useAllergens();
    await new Promise(process.nextTick);

    form.allergens = 'Peanut, Egg';
    
    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 200,
      data: { allergens: ['Peanut', 'Egg'] },
    });

    const result = await handleSave();

    expect(saving.value).toBe(false);
    expect(result).toBe(true);
    expect(updateUserProfile).toHaveBeenCalledWith({
      allergens: ['Peanut', 'Egg'],
    });
    expect(mockStore.updateLocalUserInfo).toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '保存成功' }));
  });

  it('should handle save failure', async () => {
    const { handleSave, saving } = useAllergens();
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

  it('should parse complex allergen strings', async () => {
    const { form, handleSave } = useAllergens();
    await new Promise(process.nextTick);

    form.allergens = 'Peanut,  Milk; Egg\nSoy';
    
    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 200,
      data: { allergens: ['Peanut', 'Milk', 'Egg', 'Soy'] },
    });

    await handleSave();

    expect(updateUserProfile).toHaveBeenCalledWith({
      allergens: ['Peanut', 'Milk', 'Egg', 'Soy'],
    });
  });
});
