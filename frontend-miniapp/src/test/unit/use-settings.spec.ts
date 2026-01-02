import { useSettings } from '@/pages/settings/composables/use-settings';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import { ref, reactive, nextTick } from 'vue';

// Mock Store
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));

// Mock API
jest.mock('@/api/modules/user', () => ({
  updateUserProfile: jest.fn(),
}));

// Mock onShow
jest.mock('@dcloudio/uni-app', () => ({
  onShow: (fn: Function) => fn(),
}));

// Mock global.uni
(global as any).uni = {
  showToast: jest.fn(),
  showModal: jest.fn(),
  reLaunch: jest.fn(),
  navigateTo: jest.fn(),
};

describe('useSettings', () => {
  let mockStore: any;

  beforeEach(() => {
    // Use reactive to simulate Pinia store behavior
    mockStore = reactive({
      isLoggedIn: true,
      userInfo: {
        nickname: 'Initial',
        allergens: [],
        preferences: {}
      },
      fetchProfileAction: jest.fn() as unknown as jest.Mock<any, any>,
      updateLocalUserInfo: jest.fn(),
      logoutAction: jest.fn(),
    });
    (mockStore.fetchProfileAction as jest.Mock).mockResolvedValue(undefined);
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockStore);
    jest.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    const { loading } = useSettings();
    expect(loading.value).toBe(true);
    expect(mockStore.fetchProfileAction).toHaveBeenCalled();
    await nextTick();
    await nextTick();
  });

  it('should sync form with user info', async () => {
    const { form } = useSettings();
    
    // Trigger watch by updating userInfo
    mockStore.userInfo = {
      nickname: 'Test User',
      allergens: ['Peanut'],
      preferences: {
        priceRange: { min: 10, max: 20 }
      }
    };
    
    await nextTick();
    await nextTick(); // Wait for watch callback
    
    expect(form.nickname).toBe('Test User');
    expect(form.allergensText).toBe('Peanut');
    expect(form.priceRangeMin).toBe('10');
    expect(form.priceRangeMax).toBe('20');
  });

  it('should detect changes', async () => {
    const { form, canSubmit } = useSettings();
    
    mockStore.userInfo = { nickname: 'Old' };
    await nextTick();
    await nextTick();
    
    expect(canSubmit.value).toBe(false);
    
    form.nickname = 'New Name';
    expect(canSubmit.value).toBe(true);
  });

  it('should save settings successfully', async () => {
    const { form, handleSave } = useSettings();
    
    mockStore.userInfo = { nickname: 'Old' };
    await nextTick();
    await nextTick();
    
    form.nickname = 'Updated Name';

    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 200,
      data: { nickname: 'Updated Name' }
    });

    await handleSave();

    expect(updateUserProfile).toHaveBeenCalledWith(expect.objectContaining({
      nickname: 'Updated Name',
    }));
    expect(mockStore.updateLocalUserInfo).toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '保存成功' }));
  });

  it('should handle save error', async () => {
    const { form, handleSave } = useSettings();
    
    mockStore.userInfo = { nickname: 'Old' };
    await nextTick();
    
    await nextTick(); // Sync form
    form.nickname = 'Updated Name';

    (updateUserProfile as jest.Mock).mockRejectedValue(new Error('Save failed'));

    await handleSave();

    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Save failed' }));
  });
});
