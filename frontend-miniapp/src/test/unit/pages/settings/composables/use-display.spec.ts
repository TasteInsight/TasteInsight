import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useDisplay, SORT_VALUES } from '@/pages/settings/composables/use-display';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';

jest.mock('@/api/modules/user');
const updateUserProfileMock = updateUserProfile as jest.Mock;

describe('use-display composable', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    (global as any).uni = {
      showToast: jest.fn(),
      navigateBack: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
      getStorageSync: jest.fn().mockReturnValue(null),
    } as any;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
  });

  test('loadDisplaySettings populates form when user settings exist', async () => {
    const userStore = useUserStore();
    userStore.fetchProfileAction = jest.fn().mockResolvedValue(undefined);
    userStore.userInfo = {
      settings: {
        displaySettings: { showCalories: false, showNutrition: false, sortBy: 'price_high' },
      },
    } as any;
    // mark logged in so original fetchProfileAction won't early-return
    (userStore as any).token = 'tok';

    const wrapper = mount(
      {
        template: '<div />',
        setup() {
          const d = useDisplay();
          return { d };
        },
      },
      { global: { plugins: [pinia] } }
    );

    // allow microtasks and macrotasks
    await new Promise(resolve => setTimeout(resolve, 0));

    const d = (wrapper.vm as any).d as ReturnType<typeof useDisplay>;
    expect(d.form.showCalories).toBe(false);
    expect(d.form.showNutrition).toBe(false);
    expect(d.form.sortByIndex).toBe(SORT_VALUES.indexOf('price_high'));
  });

  test('loadDisplaySettings handles unknown sortBy', async () => {
    const userStore = useUserStore();
    userStore.fetchProfileAction = jest.fn().mockResolvedValue(undefined);
    userStore.userInfo = { settings: { displaySettings: { sortBy: 'unknown' } } } as any;
    (userStore as any).token = 'tok';

    const wrapper = mount(
      {
        template: '<div />',
        setup() {
          const d = useDisplay();
          return { d };
        },
      },
      { global: { plugins: [pinia] } }
    );
    await Promise.resolve();

    const d = (wrapper.vm as any).d as ReturnType<typeof useDisplay>;
    expect(d.form.sortByIndex).toBe(0);
  });

  test('loadDisplaySettings exposes the error and blocks editing on fetch failure', async () => {
    const userStore = useUserStore();
    userStore.fetchProfileAction = jest.fn().mockRejectedValue(new Error('boom'));
    (userStore as any).token = 'tok';

    const wrapper = mount(
      {
        template: '<div />',
        setup() {
          const d = useDisplay();
          return { d };
        },
      },
      { global: { plugins: [pinia] } }
    );
    await new Promise(resolve => setTimeout(resolve, 0));

    expect((wrapper.vm as any).d.loadError.value).toBe('boom');
    expect((wrapper.vm as any).d.canSave.value).toBe(false);
  });

  test('event handlers accept raw or event object values', () => {
    const d = useDisplay();

    d.onShowCaloriesChange(true);
    expect(d.form.showCalories).toBe(true);
    d.onShowCaloriesChange({ detail: { value: false } } as any);
    expect(d.form.showCalories).toBe(false);

    d.onShowNutritionChange(false);
    expect(d.form.showNutrition).toBe(false);
    d.onShowNutritionChange({ detail: { value: true } } as any);
    expect(d.form.showNutrition).toBe(true);

    d.onSortChange({ detail: { value: '3' } } as any);
    expect(d.form.sortByIndex).toBe(3);
    d.onSortChange(2);
    expect(d.form.sortByIndex).toBe(2);
    d.onSortChange('not-a-number');
    expect(d.form.sortByIndex).toBe(0);
  });

  test('handleSave success and failure', async () => {
    const userStore = useUserStore();
    userStore.userInfo = { id: 'u1' } as any;
    userStore.token = 'tok';
    userStore.fetchProfileAction = jest.fn().mockResolvedValue(undefined);

    // success
    updateUserProfileMock.mockResolvedValue({ code: 200, data: { id: 'u1' } });
    jest.useFakeTimers();

    const d = useDisplay();
    await d.loadProfile();
    const ok = await d.handleSave();
    expect(ok).toBe(true);
    expect(uni.setStorageSync).toHaveBeenCalledWith('userInfo', JSON.stringify(userStore.userInfo));
    expect((global as any).uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'success' })
    );

    // simulate timeout
    jest.runAllTimers();
    expect((global as any).uni.navigateBack).toHaveBeenCalled();
    jest.useRealTimers();

    // failure returned non-200
    updateUserProfileMock.mockResolvedValue({ code: 500, data: null, message: 'bad' });
    const d2 = useDisplay();
    await d2.loadProfile();
    const ok2 = await d2.handleSave();
    expect(ok2).toBe(false);
    expect((global as any).uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'none' })
    );

    // failure by reject
    updateUserProfileMock.mockRejectedValue(new Error('api fail'));
    const d3 = useDisplay();
    await d3.loadProfile();
    const ok3 = await d3.handleSave();
    expect(ok3).toBe(false);
  });
});
