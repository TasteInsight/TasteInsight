import { useNotifications } from '@/pages/settings/composables/use-notifications';
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

describe('useNotifications', () => {
  let mockStore: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockStore = reactive({
      userInfo: {
        settings: {
          notificationSettings: {
            newDishAlert: false,
            priceChangeAlert: true,
            reviewReplyAlert: false,
            weeklyRecommendation: false,
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

  it('should load notification settings on mount', async () => {
    const { form, loading } = useNotifications();

    expect(loading.value).toBe(true);
    await new Promise(process.nextTick);

    expect(mockStore.fetchProfileAction).toHaveBeenCalled();
    expect(form.newDishAlert).toBe(false);
    expect(form.priceChangeAlert).toBe(true);
    expect(form.reviewReplyAlert).toBe(false);
    expect(form.weeklyRecommendation).toBe(false);
    expect(loading.value).toBe(false);
  });

  it('should update fields', async () => {
    const { form, updateField } = useNotifications();
    await new Promise(process.nextTick);

    // Update with event object
    updateField('newDishAlert', { detail: { value: true } });
    expect(form.newDishAlert).toBe(true);

    // Update with boolean
    updateField('priceChangeAlert', false);
    expect(form.priceChangeAlert).toBe(false);
  });

  it('should handle save success', async () => {
    const { form, handleSave, saving } = useNotifications();
    await new Promise(process.nextTick);

    form.newDishAlert = true;

    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 200,
      data: { settings: { notificationSettings: { newDishAlert: true } } },
    });

    const result = await handleSave();

    expect(saving.value).toBe(false);
    expect(result).toBe(true);
    expect(updateUserProfile).toHaveBeenCalledWith({
      settings: {
        notificationSettings: {
          newDishAlert: true,
          priceChangeAlert: true,
          reviewReplyAlert: false,
          weeklyRecommendation: false,
        },
      },
    });
    expect(uni.setStorageSync).toHaveBeenCalledWith('userInfo', JSON.stringify(mockStore.userInfo));
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '保存成功' }));
  });

  it('should handle save failure', async () => {
    const { handleSave, saving } = useNotifications();
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
