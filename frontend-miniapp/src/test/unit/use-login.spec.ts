import { useLogin } from '@/pages/login/composables/use-login';
import { useUserStore } from '@/store/modules/use-user-store';
import { effectScope } from 'vue';
import config from '@/config';

// Mock Store
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));
jest.mock('@/config', () => ({
  __esModule: true,
  default: { platform: 'mp-weixin', testLoginEnabled: false },
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
    config.platform = 'mp-weixin';
    mockUserStore = {
      loginAction: jest.fn(),
      sessionVersion: 0,
      userInfo: null,
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
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '微信授权未完成，请重试' })
    );
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
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '登录失败，请重试' })
    );
  });

  it('shares native provider discovery and sends an App authorization code to the App login endpoint', async () => {
    config.platform = 'app';
    uni.getProvider = jest.fn();
    const { wechatAvailable, wechatLogin } = useLogin();
    expect(wechatAvailable.value).toBe(false);
    (uni.getProvider as jest.Mock).mock.calls[0][0].success({ provider: ['weixin'] });
    expect(wechatAvailable.value).toBe(true);
    (uni.login as jest.Mock).mockImplementation(({ success }) => success({ code: 'native-code' }));
    mockUserStore.loginAction.mockResolvedValue(undefined);
    await wechatLogin();
    expect(uni.login).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'weixin', onlyAuthorize: true })
    );
    expect(mockUserStore.loginAction).toHaveBeenCalledWith('native-code', 'app');
  });

  it.each(['session', 'owner', 'dispose'])(
    'does not exchange a delayed login code after %s changes',
    async change => {
      let authorized!: (value: any) => void;
      (uni.login as jest.Mock).mockImplementation(({ success }) => {
        authorized = success;
      });
      const scope = effectScope();
      const login = scope.run(useLogin)!;
      const pending = login.wechatLogin();
      if (change === 'session') mockUserStore.sessionVersion++;
      if (change === 'owner') mockUserStore.userInfo = { id: 'another-account' };
      if (change === 'dispose') scope.stop();
      authorized({ code: 'stale-code' });
      await pending;
      expect(mockUserStore.loginAction).not.toHaveBeenCalled();
      expect(uni.showToast).not.toHaveBeenCalled();
      scope.stop();
    }
  );
});
