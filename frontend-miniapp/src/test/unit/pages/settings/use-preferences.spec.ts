import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { usePreferences } from '@/pages/settings/composables/use-preferences';
import { updateUserProfile } from '@/api/modules/user';
import { getCanteenList } from '@/api/modules/canteen';
import { useUserStore } from '@/store/modules/use-user-store';

jest.mock('@/api/modules/user');
jest.mock('@/api/modules/canteen');
const directoryPage = (items: any[], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items, meta: { page, totalPages, pageSize: 100 } },
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(uni, {
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
    showToast: jest.fn(),
    navigateBack: jest.fn(),
  });
  setActivePinia(createPinia());
  const user = useUserStore();
  user.token = 'token';
  user.userInfo = {
    id: 'user',
    preferences: { tastePreferences: { spicyLevel: 2 }, favoriteIngredients: ['豆腐'] },
  } as any;
  user.fetchProfileAction = jest.fn().mockResolvedValue(undefined);
  (getCanteenList as jest.Mock).mockResolvedValue(directoryPage([{ id: 'c1', name: '第一食堂' }]));
});

it('loads user preferences even when the independent directory fails', async () => {
  (getCanteenList as jest.Mock).mockRejectedValue(new Error('食堂目录失败'));
  const wrapper = mount({
    setup() {
      return { state: usePreferences() };
    },
    template: '<div />',
  });
  await flushPromises();
  const state = (wrapper.vm as any).state as ReturnType<typeof usePreferences>;
  expect(state.initialized.value).toBe(true);
  expect(state.form.spiciness).toBe(2);
  expect(state.canteensError.value).toBe('食堂目录失败');
  expect(state.loading.value).toBe(false);
  wrapper.unmount();
});

it.each([
  [{ min: 100, max: 10 }, false],
  [{ min: 0, max: 0 }, true],
  [{ min: -1, max: 10 }, false],
  [{ min: NaN, max: 10 }, false],
  [{ min: 1, max: Infinity }, false],
])('validates %j without mutating the draft', (range, valid) => {
  const state = usePreferences();
  state.form.priceRange = { ...range };
  expect(state.validatePriceRange()).toBe(valid);
  expect(state.form.priceRange).toEqual(range);
  expect(uni.showToast).not.toHaveBeenCalled();
});

it('keeps a two-field price edit through its temporary invalid state', () => {
  const state = usePreferences();
  state.form.priceRange = { min: 20, max: 15 };
  expect(state.validatePriceRange()).toBe(false);
  state.form.priceRange.min = 5;
  expect(state.validatePriceRange()).toBe(true);
  expect(state.form.priceRange).toEqual({ min: 5, max: 15 });
});

it('loads the full directory and allows a canteen from the second page', async () => {
  (getCanteenList as jest.Mock)
    .mockResolvedValueOnce(directoryPage([{ id: 'c1', name: '第一食堂' }], 1, 2))
    .mockResolvedValueOnce(directoryPage([{ id: 'c2', name: '第二食堂' }], 2, 2));
  const state = usePreferences();
  expect(await state.loadCanteens()).toBe(true);
  expect((getCanteenList as jest.Mock).mock.calls.map(call => call[0])).toEqual([
    { page: 1, pageSize: 100 },
    { page: 2, pageSize: 100 },
  ]);
  state.onCanteenSelect({ detail: { value: 1 } });
  expect(state.form.canteenPreferences).toEqual(['c2']);
  expect(state.getCanteenNameById('c2')).toBe('第二食堂');
  expect(state.getCanteenNameById('missing')).toBe('食堂信息暂不可用');
  state.onCanteenSelect({ detail: { value: 1 } });
  expect(state.form.canteenPreferences).toEqual(['c2']);
});

it('adds and removes ingredients without duplicate entries', () => {
  const state = usePreferences();
  state.form.favoriteIngredients = ['豆腐'];
  state.newFavoriteIngredient.value = '豆腐';
  state.addFavoriteIngredient();
  expect(state.form.favoriteIngredients).toEqual(['豆腐']);
  state.newFavoriteIngredient.value = '番茄';
  state.addFavoriteIngredient();
  expect(state.newFavoriteIngredient.value).toBe('');
  expect(state.form.favoriteIngredients).toEqual(['豆腐', '番茄']);
  state.removeFavoriteIngredient(0);
  expect(state.form.favoriteIngredients).toEqual(['番茄']);
});

it('includes pending ingredient text in dirty state and submits it on save', async () => {
  const state = usePreferences();
  await state.loadProfile();
  state.newFavoriteIngredient.value = '番茄';
  expect(state.dirty.value).toBe(true);
  (updateUserProfile as jest.Mock).mockResolvedValue({ code: 200, data: { preferences: {} } });
  expect(await state.handleSave()).toBe(true);
  expect(updateUserProfile).toHaveBeenCalledWith(
    expect.objectContaining({
      preferences: expect.objectContaining({ favoriteIngredients: ['豆腐', '番茄'] }),
    })
  );
  expect(state.saved.value).toBe(true);
});

it('keeps edits and exposes save failure without claiming success', async () => {
  const state = usePreferences();
  await state.loadProfile();
  state.form.priceRange = { min: 1, max: 5 };
  (updateUserProfile as jest.Mock).mockResolvedValue({ code: 400, message: '保存失败' });
  expect(await state.handleSave()).toBe(false);
  expect(state.form.priceRange).toEqual({ min: 1, max: 5 });
  expect(state.saved.value).toBe(false);
  expect(uni.showToast).not.toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
});
