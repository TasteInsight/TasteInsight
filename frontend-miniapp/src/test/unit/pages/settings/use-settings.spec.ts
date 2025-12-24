jest.mock('@/store/modules/use-user-store');
jest.mock('@/api/modules/user');
jest.mock('@dcloudio/uni-app', () => ({ onShow: jest.fn() }));

import { useSettings } from '@/pages/settings/composables/use-settings';
import { updateUserProfile } from '@/api/modules/user';
import { useUserStore as _useUserStore } from '@/store/modules/use-user-store';

const mockedUpdate = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;
const mockedUseUserStore = _useUserStore as jest.MockedFunction<typeof _useUserStore>;

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).uni = (global as any).uni || {};
    (global as any).uni.showToast = jest.fn();
    (global as any).uni.reLaunch = jest.fn();
  });

  test('syncForm applies user info into form', () => {
    const user = {
      nickname: 'nick',
      avatar: 'a',
      allergens: ['a','b'],
      preferences: {
        favoriteIngredients: ['f1'],
        avoidIngredients: ['av1'],
        priceRange: { min: 3, max: 10 },
        tastePreferences: { spicyLevel: 2 }
      },
      settings: {
        displaySettings: { showCalories: true, sortBy: 'rating' },
        notificationSettings: { newDishAlert: true }
      }
    } as any;

    mockedUseUserStore.mockReturnValue({ isLoggedIn: true, userInfo: user, fetchProfileAction: jest.fn(), updateLocalUserInfo: jest.fn() } as any);

    const { form, avatarPreview } = useSettings();
    expect(form.nickname).toBe('nick');
    expect(avatarPreview.value).toContain('a');
    expect(form.favoriteIngredientsText).toContain('f1');
    expect(form.priceRangeMin).toBe('3');
    expect(form.spicyLevel).toBe(2);
  });

  test('handleSave shows login toast when not logged in', async () => {
    mockedUseUserStore.mockReturnValue({ isLoggedIn: false, userInfo: null } as any);
    const { handleSave } = useSettings();
    await handleSave();
    expect((global as any).uni.showToast).toHaveBeenCalledWith({ title: '请先登录', icon: 'none' });
  });

  test('handleSave shows no-modify toast when nothing changed', async () => {
    const store = { isLoggedIn: true, userInfo: null, fetchProfileAction: jest.fn(), updateLocalUserInfo: jest.fn() } as any;
    mockedUseUserStore.mockReturnValue(store);
    const { handleSave } = useSettings();
    await handleSave();
    expect((global as any).uni.showToast).toHaveBeenCalledWith({ title: '没有修改内容', icon: 'none' });
  });

  test('handleSave builds payload with preferences and settings and succeeds', async () => {
    const store = { isLoggedIn: true, userInfo: null, fetchProfileAction: jest.fn(), updateLocalUserInfo: jest.fn() } as any;
    mockedUseUserStore.mockReturnValue(store);
    mockedUpdate.mockResolvedValueOnce({ code: 200, data: { nickname: 'n' } } as any);

    const s = useSettings();
    s.form.nickname = 'n';
    // make a change to favoriteIngredientsText
    s.form.favoriteIngredientsText = 'a, b';
    s.form.priceRangeMin = '2';

    await s.handleSave();

    expect(mockedUpdate).toHaveBeenCalled();
    expect(store.updateLocalUserInfo).toHaveBeenCalled();
    expect((global as any).uni.showToast).toHaveBeenCalledWith({ title: '保存成功', icon: 'success' });
  });

  test('handleSave failure shows toast', async () => {
    const store = { isLoggedIn: true, userInfo: null, fetchProfileAction: jest.fn(), updateLocalUserInfo: jest.fn() } as any;
    mockedUseUserStore.mockReturnValue(store);
    mockedUpdate.mockResolvedValueOnce({ code: 400, message: 'Bad' } as any);

    const s = useSettings();
    s.form.nickname = 'x';

    await s.handleSave();
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });
});