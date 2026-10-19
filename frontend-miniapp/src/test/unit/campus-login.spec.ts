import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, ref, type Ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useCampusLogin } from '@/pages/login/composables/use-campus-login';
import CampusAuth from '@/pages/login/campus-auth.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import {
  startCampusLogin,
  campusLogin,
  loginMethods,
  verificationMethods,
} from '@/api/modules/auth';
import { getUserProfile } from '@/api/modules/user';
import {
  campusLoginMessage,
  campusLoginTicket,
  readCampusLoginPending,
  saveCampusLoginPending,
} from '@/utils/campus-login';
import config from '@/config';

jest.mock('@/utils/request', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@dcloudio/uni-app', () => ({ onShow: jest.fn(), onLoad: jest.fn() }));
jest.mock('@/config', () => ({
  __esModule: true,
  default: { platform: 'h5', baseUrl: 'https://api.example/api/v1' },
}));
jest.mock('@/api/modules/auth', () => ({
  ...jest.requireActual('@/api/modules/auth'),
  startCampusLogin: jest.fn(),
  campusLogin: jest.fn(),
}));
jest.mock('@/api/modules/user', () => ({ getUserProfile: jest.fn(), wechatLogin: jest.fn() }));
const storage = new Map<string, string>();
const start = () => ({
  attemptId: 'attempt',
  authorizationUrl: 'https://school.example/authorize?state=state',
  expiresAt: new Date(Date.now() + 900000).toISOString(),
  loginVerifier: 'v'.repeat(43),
});
const code = 'c'.repeat(43);
let popup: any;
let flow: ReturnType<typeof useCampusLogin>;
let enabled: Ref<boolean>;
const wrappers: ReturnType<typeof mount>[] = [];
const page = () => {
  enabled = ref(true);
  const wrapper = mount(
    defineComponent({
      setup() {
        flow = useCampusLogin(enabled);
        return () => null;
      },
    })
  );
  wrappers.push(wrapper);
  return wrapper;
};
beforeEach(() => {
  jest.clearAllMocks();
  storage.clear();
  config.platform = 'h5';
  uni.getStorageSync = jest.fn(key => storage.get(key)) as typeof uni.getStorageSync;
  uni.setStorageSync = jest.fn((key, value) => {
    storage.set(key, value);
  });
  uni.removeStorageSync = jest.fn(key => {
    storage.delete(key);
  });
  setActivePinia(createPinia());
  popup = { location: { replace: jest.fn() }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(popup);
  (globalThis as any).plus = { runtime: { openURL: jest.fn() } };
  (startCampusLogin as jest.Mock).mockResolvedValue({ data: start() });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.restoreAllMocks();
});

test('separates grouped methods and retains legacy verification without inventing campus login', () => {
  const legacy = {
    phone: false,
    wechatMiniapp: true,
    wechatApp: false,
    campusEmail: true,
    campusOAuth: true,
  };
  expect(loginMethods(legacy).campusOAuth).toBe(false);
  expect(verificationMethods(legacy).campusOAuth).toBe(true);
  expect(
    loginMethods({
      ...legacy,
      loginMethods: { phone: false, wechatMiniapp: false, wechatApp: false, campusOAuth: true },
    }).campusOAuth
  ).toBe(true);
});
test('keeps initiating proof out of the authorization URL, validates popup source, origin, type and attempt', async () => {
  page();
  await flow.start();
  expect(popup.location.replace).toHaveBeenCalledWith(start().authorizationUrl);
  expect(readCampusLoginPending()).toMatchObject({
    attemptId: 'attempt',
    loginVerifier: 'v'.repeat(43),
  });
  const event = {
    origin: 'https://api.example',
    source: popup,
    data: { type: 'tasteinsight:campus-login', attemptId: 'attempt', handoffCode: code },
  };
  expect(campusLoginMessage(event, popup, 'https://api.example')).toBe(code);
  for (const invalid of [
    { ...event, origin: 'https://other.example' },
    { ...event, source: {} },
    { ...event, data: { ...event.data, type: 'tasteinsight:campus-oauth' } },
    { ...event, data: { ...event.data, attemptId: 'other' } },
  ])
    expect(campusLoginMessage(invalid as any, popup, 'https://api.example')).toBeNull();
  expect(campusLoginTicket(code)).toEqual({
    attemptId: 'attempt',
    handoffCode: code,
    loginVerifier: 'v'.repeat(43),
  });
});
test('retains a valid ticket and confirmation form after network failure, then completes retry', async () => {
  page();
  await flow.start();
  flow.code.value = code;
  const user = useUserStore();
  (campusLogin as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(user.campusLoginAction(campusLoginTicket(code))).rejects.toThrow('offline');
  await flushPromises();
  expect(flow.pending.value?.attemptId).toBe('attempt');
  expect(flow.code.value).toBe(code);
  expect(readCampusLoginPending()?.loginVerifier).toBe('v'.repeat(43));
  expect(user.isLoggedIn).toBe(false);
  (campusLogin as jest.Mock).mockResolvedValueOnce({
    data: {
      token: { accessToken: 'access', refreshToken: 'refresh' },
      user: { id: 'campus-user', nickname: '校园用户' },
    },
  });
  (getUserProfile as jest.Mock).mockResolvedValue({
    code: 200,
    data: { id: 'campus-user', nickname: '校园用户' },
  });
  await user.campusLoginAction(campusLoginTicket(code));
  expect(user.isLoggedIn).toBe(true);
  expect(user.userInfo?.id).toBe('campus-user');
  expect(readCampusLoginPending()).toBeNull();
});
test('logout clears pending authorization and stale start responses cannot revive it', async () => {
  page();
  let finish!: (value: unknown) => void;
  (startCampusLogin as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const work = flow.start();
  useUserStore().logoutAction();
  finish({ data: start() });
  await work;
  await flushPromises();
  expect(readCampusLoginPending()).toBeNull();
  expect(flow.pending.value).toBeNull();
});
test('expires persisted attempts and rejects malformed confirmation codes', () => {
  saveCampusLoginPending(start());
  expect(() => campusLoginTicket('short')).toThrow('完整确认码');
  saveCampusLoginPending({ ...start(), expiresAt: new Date(0).toISOString() });
  expect(readCampusLoginPending()).toBeNull();
});
test('does not create a request on a disabled entry and uses the native browser on Android', async () => {
  page();
  enabled.value = false;
  await flow.start();
  expect(startCampusLogin).not.toHaveBeenCalled();
  enabled.value = true;
  config.platform = 'app';
  await flow.start();
  expect(plus.runtime.openURL).toHaveBeenCalledWith(start().authorizationUrl);
});
test('routes miniapp authorization to a dedicated web-view and starts there independently of query input', async () => {
  page();
  config.platform = 'mp-weixin';
  await flow.start();
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/login/campus-auth' });
  expect(startCampusLogin).not.toHaveBeenCalled();
  const wrapper = mount(CampusAuth, {
    global: { stubs: { 'web-view': { template: '<div class="webview" v-bind="$attrs" />' } } },
  });
  wrappers.push(wrapper);
  await (onLoad as jest.Mock).mock.calls.slice(-1)[0][0]({
    url: 'https://attacker.example',
    attemptId: 'other',
  });
  await flushPromises();
  expect(wrapper.find('.webview').attributes('src')).toBe(start().authorizationUrl);
  expect(readCampusLoginPending()?.attemptId).toBe('attempt');
});
test('a stale login response after logout cannot restore tokens or its ticket', async () => {
  page();
  await flow.start();
  let finish!: (value: unknown) => void;
  (campusLogin as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const user = useUserStore();
  const work = user.campusLoginAction(campusLoginTicket(code)).catch(error => error);
  user.logoutAction();
  finish({ data: { token: { accessToken: 'stale' }, user: { id: 'stale' } } });
  await work;
  await flushPromises();
  expect(user.token).toBeNull();
  expect(readCampusLoginPending()).toBeNull();
});

test('explicit cancellation invalidates an authorization request still in flight', async () => {
  page();
  let finish!: (value: unknown) => void;
  (startCampusLogin as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const work = flow.start();
  flow.cancel();
  expect(flow.starting.value).toBe(false);
  finish({ data: start() });
  await work;
  expect(readCampusLoginPending()).toBeNull();
  expect(flow.pending.value).toBeNull();
});
