import { usePreferences } from '@/pages/settings/composables/use-preferences';
import { useUserStore } from '@/store/modules/use-user-store';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { updateUserProfile } from '@/api/modules/user';
import { reactive, ref } from 'vue';

// Mock Stores
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));
jest.mock('@/store/modules/use-canteen-store', () => ({
  useCanteenStore: jest.fn(),
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
};

describe('usePreferences', () => {
  let mockUserStore: any;
  let mockCanteenStore: any;

  beforeEach(() => {
    mockUserStore = reactive({
      userInfo: {
        preferences: {
          tastePreferences: {
            spicyLevel: 1,
            sweetness: 2,
            saltiness: 3,
            oiliness: 4,
          },
          portionSize: 'small',
          meatPreference: ['beef'],
          priceRange: { min: 10, max: 50 },
          canteenPreferences: ['canteen1'],
          avoidIngredients: ['onion'],
          favoriteIngredients: ['tomato'],
        },
      },
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
      updateLocalUserInfo: jest.fn(),
    });
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockUserStore);

    mockCanteenStore = reactive({
      canteenList: [{ id: 'canteen1', name: 'Canteen 1' }],
      fetchCanteenList: jest.fn().mockResolvedValue(undefined),
    });
    (useCanteenStore as unknown as jest.Mock).mockReturnValue(mockCanteenStore);

    jest.clearAllMocks();
  });

  it('should load preferences on mount', async () => {
    mockCanteenStore.canteenList = []; // Ensure it's empty to trigger fetch
    const { form, loading } = usePreferences();
    
    expect(loading.value).toBe(true);
    await new Promise(process.nextTick);

    expect(mockCanteenStore.fetchCanteenList).toHaveBeenCalled();
    expect(mockUserStore.fetchProfileAction).toHaveBeenCalled();
    
    expect(form.spiciness).toBe(1);
    expect(form.sweetness).toBe(2);
    expect(form.saltiness).toBe(3);
    expect(form.oiliness).toBe(4);
    expect(form.portionSize).toBe('small');
    expect(form.meatPreference).toEqual(['beef']);
    expect(form.priceRange).toEqual({ min: 10, max: 50 });
    expect(form.canteenPreferences).toEqual(['canteen1']);
    expect(form.avoidIngredients).toEqual(['onion']);
    expect(form.favoriteIngredients).toEqual(['tomato']);
    
    expect(loading.value).toBe(false);
  });

  it('should handle save success', async () => {
    const { form, handleSave, saving } = usePreferences();
    await new Promise(process.nextTick);

    form.spiciness = 5;
    
    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 200,
      data: { preferences: { ...mockUserStore.userInfo.preferences, tastePreferences: { spicyLevel: 5 } } },
    });

    const result = await handleSave();

    expect(saving.value).toBe(false);
    expect(result).toBe(true);
    expect(updateUserProfile).toHaveBeenCalled();
    expect(mockUserStore.updateLocalUserInfo).toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '保存成功' }));
  });

  it('should handle save failure', async () => {
    const { handleSave, saving } = usePreferences();
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

  it('should validate price range', async () => {
    const { form, handleSave } = usePreferences();
    await new Promise(process.nextTick);

    form.priceRange.min = 100;
    form.priceRange.max = 50; // Invalid

    const result = await handleSave();

    expect(result).toBe(false);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '最低价格必须小于最高价格' }));
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it('should add and remove items', async () => {
    const { 
      form, 
      newFavoriteIngredient, addFavoriteIngredient, removeFavoriteIngredient,
      newMeatPreference, addMeatPreference, removeMeatPreference,
      newAvoidIngredient, addAvoidIngredient, removeAvoidIngredient
    } = usePreferences();
    await new Promise(process.nextTick);

    // Favorite Ingredients
    newFavoriteIngredient.value = 'potato';
    addFavoriteIngredient();
    expect(form.favoriteIngredients).toContain('potato');
    expect(newFavoriteIngredient.value).toBe('');

    const potatoIndex = form.favoriteIngredients.indexOf('potato');
    removeFavoriteIngredient(potatoIndex);
    expect(form.favoriteIngredients).not.toContain('potato');

    // Meat Preference
    newMeatPreference.value = 'pork';
    addMeatPreference();
    expect(form.meatPreference).toContain('pork');
    expect(newMeatPreference.value).toBe('');

    const porkIndex = form.meatPreference.indexOf('pork');
    removeMeatPreference(porkIndex);
    expect(form.meatPreference).not.toContain('pork');

    // Avoid Ingredients
    newAvoidIngredient.value = 'garlic';
    addAvoidIngredient();
    expect(form.avoidIngredients).toContain('garlic');
    expect(newAvoidIngredient.value).toBe('');

    const garlicIndex = form.avoidIngredients.indexOf('garlic');
    removeAvoidIngredient(garlicIndex);
    expect(form.avoidIngredients).not.toContain('garlic');
  });

  it('should not add empty or duplicate items', async () => {
    const { form, newFavoriteIngredient, addFavoriteIngredient } = usePreferences();
    await new Promise(process.nextTick);

    // Empty
    newFavoriteIngredient.value = '  ';
    addFavoriteIngredient();
    expect(form.favoriteIngredients).toHaveLength(1); // Initial 'tomato'

    // Duplicate
    newFavoriteIngredient.value = 'tomato';
    addFavoriteIngredient();
    expect(form.favoriteIngredients).toHaveLength(1);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已存在该食材' }));
  });
});
