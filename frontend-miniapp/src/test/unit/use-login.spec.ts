import { useLogin } from '@/pages/login/composables/use-login';
import { useUserStore } from '@/store/modules/use-user-store';
import { ref } from 'vue';

// Mock Store
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));

// Mock uni-app APIs
(global as any).uni = {
  login: jest.fn(),
  showToast: jest.fn(),
  switchTab: jest.fn(),
} as any;

describe('useLogin', () => {
  let mockUserStore: any;

  beforeEach(() => {
    mockUserStore = {
      loginAction: jest.fn(),
    };
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockUserStore);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should handle successful login', async () => {
    const { wechatLogin, loading } = useLogin();
    
    // Mock uni.login success
    (uni.login as jest.Mock).mockImplementation(({ success }) => {
      success({ code: 'test-code' });
    });

    // Mock store login success
    mockUserStore.loginAction.mockResolvedValue(undefined);

    const loginPromise = wechatLogin();
    
    expect(loading.value).toBe(true);
    
    await loginPromise;

    expect(loading.value).toBe(false);
    expect(uni.login).toHaveBeenCalled();
    expect(mockUserStore.loginAction).toHaveBeenCalledWith('test-code');
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '登录成功' }));
    
    // Fast-forward timers for switchTab
    jest.runAllTimers();
    expect(uni.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  it('should handle uni.login failure', async () => {
    const { wechatLogin, loading } = useLogin();
    
    // Mock uni.login fail
    (uni.login as jest.Mock).mockImplementation(({ fail }) => {
      fail({ errMsg: 'login:fail error' });
    });

    try {
      await wechatLogin();
    } catch (e) {
      // Expected error
    }

    expect(loading.value).toBe(false);
    expect(mockUserStore.loginAction).not.toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '微信登录失败，请检查网络连接' }));
  });

  it('should handle store login failure', async () => {
    const { wechatLogin, loading } = useLogin();
    
    // Mock uni.login success
    (uni.login as jest.Mock).mockImplementation(({ success }) => {
      success({ code: 'test-code' });
    });

    // Mock store login fail
    mockUserStore.loginAction.mockRejectedValue(new Error('API Error'));

    try {
      await wechatLogin();
    } catch (e) {
      // Expected error
    }

    expect(loading.value).toBe(false);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '登录失败，请重试' }));
  });
});
