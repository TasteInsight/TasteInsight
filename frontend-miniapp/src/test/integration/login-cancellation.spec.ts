import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';
import { useLogin } from '@/pages/login/composables/use-login';
import { useUserStore } from '@/store/modules/use-user-store';
import { wechatLogin, getUserProfile } from '@/api/modules/user';
jest.mock('@/api/modules/user', () => ({ wechatLogin: jest.fn(), getUserProfile: jest.fn() }));
jest.mock('@/config', () => ({
  __esModule: true,
  default: { platform: 'mp-weixin', testLoginEnabled: false },
}));
function deferred() {
  let resolve!: (value?: any) => void;
  const promise = new Promise<any>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks();
  uni.getStorageSync = jest.fn();
  uni.setStorageSync = jest.fn();
  uni.removeStorageSync = jest.fn();
  uni.showToast = jest.fn();
  uni.switchTab = jest.fn();
  uni.login = jest.fn(({ success }: any) => success?.({ code: 'code', errMsg: 'login:ok' }));
  setActivePinia(createPinia());
});
test.each(['exchange', 'profile'])(
  'cancel during %s rejects late credentials and navigation',
  async phase => {
    const gate = deferred();
    const credentials = {
      data: { token: { accessToken: 'test-token', refreshToken: 'test-refresh' } },
    };
    (wechatLogin as jest.Mock).mockImplementation(() =>
      phase === 'exchange' ? gate.promise : Promise.resolve(credentials)
    );
    (getUserProfile as jest.Mock).mockImplementation(() => gate.promise);
    const scope = effectScope();
    const login = scope.run(() => useLogin())!;
    const user = useUserStore();
    const pending = login.wechatLogin();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    login.cancel();
    expect(user.isLoggedIn).toBe(false);
    gate.resolve(phase === 'exchange' ? credentials : { code: 200, data: { id: 'late-user' } });
    await pending;
    expect(user.isLoggedIn).toBe(false);
    expect(user.userInfo).toBeNull();
    expect(uni.switchTab).not.toHaveBeenCalled();
    expect(uni.showToast).not.toHaveBeenCalled();
    scope.stop();
  }
);
test('leaving during native authorization ignores its delayed code', async () => {
  let authorized: any;
  (uni.login as jest.Mock).mockImplementation(({ success }) => {
    authorized = success;
  });
  const scope = effectScope();
  const login = scope.run(() => useLogin())!;
  const pending = login.wechatLogin();
  scope.stop();
  authorized({ code: 'late' });
  await pending;
  expect(wechatLogin).not.toHaveBeenCalled();
});

test('a late login failure cannot clear or notify a different signed-in account', async () => {
  const gate = deferred();
  (wechatLogin as jest.Mock).mockReturnValue(gate.promise);
  const scope = effectScope();
  const login = scope.run(() => useLogin())!;
  const user = useUserStore();
  const pending = login.wechatLogin();
  await Promise.resolve();
  user.logoutAction();
  user.token = 'new-owner-token';
  user.userInfo = { id: 'new-owner' } as any;
  gate.resolve({ data: { token: { accessToken: 'old-owner-token' } } });
  await pending;
  expect(user.token).toBe('new-owner-token');
  expect(user.userInfo?.id).toBe('new-owner');
  expect(uni.showToast).not.toHaveBeenCalled();
  scope.stop();
});
test('unloading after successful navigation keeps the completed login session', async () => {
  (wechatLogin as jest.Mock).mockResolvedValue({
    data: { token: { accessToken: 'accepted-token' } },
  });
  (getUserProfile as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'accepted-user' } });
  const scope = effectScope();
  const login = scope.run(() => useLogin())!;
  (global as any).getCurrentPages = () => [
    { route: 'pages/profile/index' },
    { route: 'pages/login/index' },
  ];
  uni.navigateBack = jest.fn(() => {
    scope.stop();
  });
  await login.wechatLogin();
  expect(useUserStore().token).toBe('accepted-token');
  expect(uni.navigateBack).toHaveBeenCalledTimes(1);
  delete (global as any).getCurrentPages;
});
