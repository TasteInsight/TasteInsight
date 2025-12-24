jest.mock('@/store/modules/use-user-store');
jest.mock('@/store/modules/use-canteen-store');
jest.mock('@/api/modules/user');

import { usePreferences } from '@/pages/settings/composables/use-preferences';
import { updateUserProfile } from '@/api/modules/user';
import { useUserStore as _useUserStore } from '@/store/modules/use-user-store';
import { useCanteenStore as _useCanteenStore } from '@/store/modules/use-canteen-store';

const mockedUpdate = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;
const mockedUseUserStore = _useUserStore as jest.MockedFunction<typeof _useUserStore>;
const mockedUseCanteenStore = _useCanteenStore as jest.MockedFunction<typeof _useCanteenStore>;

describe('usePreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).uni = (global as any).uni || {};
    (global as any).uni.showToast = jest.fn();
    (global as any).uni.navigateBack = jest.fn();

    const fetchCanteenStub = jest.fn() as unknown as jest.Mock<any, any>;
    fetchCanteenStub.mockResolvedValue(undefined);
    mockedUseCanteenStore.mockReturnValue({ canteenList: [], fetchCanteenList: fetchCanteenStub } as any);

    const fetchProfileStub = jest.fn() as unknown as jest.Mock<any, any>;
    fetchProfileStub.mockResolvedValue(undefined);
    mockedUseUserStore.mockReturnValue({ fetchProfileAction: fetchProfileStub, userInfo: null, updateLocalUserInfo: jest.fn() } as any);
  });

  test('onMounted loadPreferences calls canteenStore.fetchCanteenList and userStore.fetchProfileAction when used inside a component', async () => {
    const { mount } = require('@vue/test-utils');
    const { defineComponent } = require('vue');

    const fetchCanteen = jest.fn() as unknown as jest.Mock<any, any>;
    fetchCanteen.mockResolvedValue(undefined);
    const fetchProfile = jest.fn() as unknown as jest.Mock<any, any>;
    fetchProfile.mockResolvedValue(undefined);

    mockedUseCanteenStore.mockReturnValue({ canteenList: [], fetchCanteenList: fetchCanteen } as any);
    mockedUseUserStore.mockReturnValue({ fetchProfileAction: fetchProfile, userInfo: { preferences: { tastePreferences: { spicyLevel: 2 }, portionSize: 'large', favoriteIngredients: ['f'] } }, updateLocalUserInfo: jest.fn() } as any);

    const wrapper = mount(defineComponent({
      setup() {
        const s = usePreferences();
        return { s };
      },
      template: '<div />',
    }));

    // allow onMounted async to run
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchCanteen).toHaveBeenCalled();
    expect(fetchProfile).toHaveBeenCalled();
    expect(wrapper.vm.s.loading.value).toBe(false);
  });

  test('validatePriceRange resets invalid range and shows toast', () => {
    const s = usePreferences();
    s.form.priceRange = { min: 100, max: 10 } as any;
    const ok = s.validatePriceRange();
    expect(ok).toBe(false);
    expect(s.form.priceRange).toEqual({ min: 20, max: 100 });
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('addFavoriteIngredient avoids duplicates and clears input', () => {
    const s = usePreferences();
    s.form.favoriteIngredients = ['a'];
    s.newFavoriteIngredient.value = 'a';
    s.addFavoriteIngredient();
    expect((global as any).uni.showToast).toHaveBeenCalled();

    s.newFavoriteIngredient.value = 'b';
    s.addFavoriteIngredient();
    expect(s.form.favoriteIngredients).toContain('b');
    expect(s.newFavoriteIngredient.value).toBe('');
  });

  test('onCanteenSelect handles select and duplicate', () => {
    mockedUseCanteenStore.mockReturnValue({ canteenList: [{ id: 'c1', name: 'C1' }] } as any);
    const s = usePreferences();
    s.onCanteenSelect({ detail: { value: 0 } } as any);
    expect(s.form.canteenPreferences).toContain('c1');
    // duplicate
    s.onCanteenSelect({ detail: { value: 0 } } as any);
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('getCanteenNameById returns id when not found', () => {
    mockedUseCanteenStore.mockReturnValue({ canteenList: [{ id: 'c1', name: 'C1' }] } as any);
    const s = usePreferences();
    expect(s.getCanteenNameById('c1')).toBe('C1');
    expect(s.getCanteenNameById('notexist')).toBe('notexist');
  });

  test('handleSave success and failure', async () => {
    const store = mockedUseUserStore.mockReturnValue({ updateLocalUserInfo: jest.fn() } as any);

    mockedUpdate.mockResolvedValueOnce({ code: 200, data: { preferences: {} } } as any);
    const s = usePreferences();
    const ok = await s.handleSave();
    expect(ok).toBe(true);
    expect((global as any).uni.showToast).toHaveBeenCalledWith({ title: '保存成功', icon: 'success' });

    mockedUpdate.mockResolvedValueOnce({ code: 400, message: 'Bad' } as any);
    const s2 = usePreferences();
    s2.form.priceRange = { min: 1, max: 5 } as any;
    const fail = await s2.handleSave();
    expect(fail).toBe(false);
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });
});
