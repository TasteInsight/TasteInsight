import { flushPromises, shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import Identity from '@/pages/profile/identity.vue';
import CampusAuth from '@/pages/profile/campus-auth.vue';
import * as auth from '@/api/modules/auth';
import { useUserStore } from '@/store/modules/use-user-store';
import { readCampusOAuthPending, saveCampusOAuthPending } from '@/utils/campus-oauth';
import config from '@/config';

jest.mock('@dcloudio/uni-app', () => ({ onShow: jest.fn(), onLoad: jest.fn() }));
jest.mock('@/config', () => ({
  __esModule: true,
  default: { platform: 'h5', baseUrl: 'https://api.example/api/v1' },
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/api/modules/auth', () => ({
  getAuthCapabilities: jest.fn(),
  getStudentVerification: jest.fn(),
  getAccountIdentities: jest.fn(),
  sendCampusEmailCode: jest.fn(),
  verifyCampusEmail: jest.fn(),
  startCampusOAuth: jest.fn(),
  completeCampusOAuth: jest.fn(),
  sendBindingPhoneCode: jest.fn(),
  bindPhone: jest.fn(),
  bindWechat: jest.fn(),
}));

let user: any;
const wrappers: any[] = [];
const storage = new Map<string, string>();
let popup: any;
const code = 'a'.repeat(43);
const start = () => ({
  attemptId: 'attempt-a',
  authorizationUrl: 'https://school.example/authorize?state=state',
  expiresAt: new Date(Date.now() + 900000).toISOString(),
  account: { id: 'alice', nickname: '同学' },
});
const button = (wrapper: any, label: string) =>
  wrapper.findAll('button').find((item: any) => item.text() === label)!;
beforeEach(() => {
  jest.clearAllMocks();
  config.platform = 'h5';
  uni.getProvider = jest.fn(({ success }) => success?.({ provider: ['weixin'] } as any));
  uni.login = jest.fn();
  storage.clear();
  user = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: { id: 'alice' },
    fetchProfileAction: jest.fn().mockResolvedValue(undefined),
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (uni.getStorageSync as jest.Mock).mockImplementation(key => storage.get(key));
  (uni.setStorageSync as jest.Mock).mockImplementation((key, value) => storage.set(key, value));
  (uni.removeStorageSync as jest.Mock).mockImplementation(key => storage.delete(key));
  (auth.getStudentVerification as jest.Mock).mockResolvedValue({
    data: { status: 'UNVERIFIED', canContribute: false },
  });
  (auth.getAuthCapabilities as jest.Mock).mockResolvedValue({ data: { campusOAuth: true } });
  (auth.getAccountIdentities as jest.Mock).mockResolvedValue({ data: { wechat: {} } });
  (auth.startCampusOAuth as jest.Mock).mockResolvedValue({ data: start() });
  (auth.completeCampusOAuth as jest.Mock).mockResolvedValue({
    data: { completed: true, status: 'VERIFIED' },
  });
  popup = { location: { replace: jest.fn() }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(popup);
  (globalThis as any).plus = { runtime: { openURL: jest.fn() } };
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.restoreAllMocks();
});
async function page() {
  const wrapper = shallowMount(Identity);
  wrappers.push(wrapper);
  await (onShow as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  return wrapper;
}
function dispatch(source = popup, origin = 'https://api.example', attemptId = 'attempt-a') {
  window.dispatchEvent(
    new MessageEvent('message', {
      source,
      origin,
      data: { type: 'tasteinsight:campus-oauth', attemptId, handoffCode: code },
    })
  );
}
test('a valid callback fills the code but never grants or refreshes privileges until explicit completion', async () => {
  const wrapper = await page();
  (user.fetchProfileAction as jest.Mock).mockClear();
  await button(wrapper, '前往认证').trigger('click');
  await flushPromises();
  expect(popup.location.replace).toHaveBeenCalledWith(start().authorizationUrl);
  expect(readCampusOAuthPending('alice')?.attemptId).toBe('attempt-a');
  dispatch({} as Window);
  dispatch(popup, 'https://attacker.example');
  dispatch(popup, 'https://api.example', 'wrong');
  await flushPromises();
  expect(
    (wrapper.get('[aria-label="校园身份一次性确认码"]').element as HTMLInputElement).value
  ).toBe('');
  dispatch();
  await flushPromises();
  expect(
    (wrapper.get('[aria-label="校园身份一次性确认码"]').element as HTMLInputElement).value
  ).toBe(code);
  expect(auth.completeCampusOAuth).not.toHaveBeenCalled();
  expect(user.fetchProfileAction).not.toHaveBeenCalled();
  await button(wrapper, '确认绑定到当前账号').trigger('click');
  await flushPromises();
  expect(auth.completeCampusOAuth).toHaveBeenCalledWith('attempt-a', code);
  expect(readCampusOAuthPending('alice')).toBeNull();
  expect(user.fetchProfileAction).toHaveBeenCalledTimes(1);
});
test('supports a persisted same-owner attempt and manually pasted callback code', async () => {
  saveCampusOAuthPending('alice', start());
  const wrapper = await page();
  await wrapper.get('[aria-label="校园身份一次性确认码"]').setValue(code);
  await button(wrapper, '确认绑定到当前账号').trigger('click');
  await flushPromises();
  expect(auth.completeCampusOAuth).toHaveBeenCalledWith('attempt-a', code);
});
test('does not save an authorization response after an account switch', async () => {
  let resolve!: (value: any) => void;
  (auth.startCampusOAuth as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const wrapper = await page();
  await button(wrapper, '前往认证').trigger('click');
  user.userInfo = { id: 'bob' };
  user.sessionVersion++;
  resolve({ data: start() });
  await flushPromises();
  expect(readCampusOAuthPending('alice')).toBeNull();
  expect(popup.location.replace).not.toHaveBeenCalled();
  expect(popup.close).toHaveBeenCalled();
  expect(auth.completeCampusOAuth).not.toHaveBeenCalled();
});
test('the miniapp webview starts its own request and ignores an incoming URL or attempt query', async () => {
  const wrapper = shallowMount(CampusAuth, {
    global: { stubs: { 'web-view': { template: '<div />' } } },
  });
  wrappers.push(wrapper);
  await (onLoad as jest.Mock).mock.calls.slice(-1)[0][0]({
    url: 'https://attacker.example',
    attemptId: 'attacker',
  });
  await flushPromises();
  expect(auth.startCampusOAuth).toHaveBeenCalledWith();
  expect(readCampusOAuthPending('alice')?.attemptId).toBe('attempt-a');
  expect(
    wrapper.findComponent({ name: 'web-view' }).exists() ||
      wrapper.html().includes('school.example')
  ).toBe(true);
});
test('the miniapp webview discards a start response after logout', async () => {
  let resolve!: (value: any) => void;
  (auth.startCampusOAuth as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const wrapper = shallowMount(CampusAuth, {
    global: { stubs: { 'web-view': { template: '<div />' } } },
  });
  wrappers.push(wrapper);
  const loading = (onLoad as jest.Mock).mock.calls.slice(-1)[0][0]({});
  user.isLoggedIn = false;
  user.userInfo = null;
  user.sessionVersion++;
  resolve({ data: start() });
  await loading;
  await flushPromises();
  expect(readCampusOAuthPending('alice')).toBeNull();
  expect(wrapper.html()).not.toContain('school.example');
});

test.each(['pending', 'missing', 'failed'])(
  'native WeChat binding stays hidden when its SDK provider is %s',
  async state => {
    config.platform = 'app';
    (auth.getAuthCapabilities as jest.Mock).mockResolvedValue({ data: { wechatApp: true } });
    (uni.getProvider as jest.Mock).mockImplementation(({ success, fail }) => {
      if (state === 'missing') success({ provider: [] });
      if (state === 'failed') fail({ errMsg: 'getProvider:fail' });
    });
    const wrapper = await page();
    expect(button(wrapper, '绑定当前微信')).toBeUndefined();
    expect(uni.login).not.toHaveBeenCalled();
  }
);

test('native WeChat binding becomes available only after provider detection succeeds', async () => {
  config.platform = 'app';
  (auth.getAuthCapabilities as jest.Mock).mockResolvedValue({ data: { wechatApp: true } });
  let ready!: (value: any) => void;
  (uni.getProvider as jest.Mock).mockImplementation(({ success }) => {
    ready = success;
  });
  const wrapper = await page();
  expect(button(wrapper, '绑定当前微信')).toBeUndefined();
  ready({ provider: ['weixin'] });
  await flushPromises();
  expect(button(wrapper, '绑定当前微信')).toBeDefined();
  (uni.login as jest.Mock).mockImplementation(({ success }) => success({ code: 'native-code' }));
  await button(wrapper, '绑定当前微信').trigger('click');
  await flushPromises();
  expect(uni.login).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'weixin', onlyAuthorize: true })
  );
  expect(auth.bindWechat).toHaveBeenCalledWith('native-code', 'app');
});

test.each(['session', 'owner', 'dispose'])(
  'a delayed WeChat authorization cannot bind after %s changes',
  async change => {
    config.platform = 'app';
    (auth.getAuthCapabilities as jest.Mock).mockResolvedValue({ data: { wechatApp: true } });
    let authorized!: (value: any) => void;
    (uni.login as jest.Mock).mockImplementation(({ success }) => {
      authorized = success;
    });
    const wrapper = await page();
    await button(wrapper, '绑定当前微信').trigger('click');
    if (change === 'session') user.sessionVersion++;
    if (change === 'owner') user.userInfo = { id: 'bob' };
    if (change === 'dispose') wrapper.unmount();
    authorized({ code: 'previous-account-code' });
    await flushPromises();
    expect(auth.bindWechat).not.toHaveBeenCalled();
  }
);

test('clears identity data on account change even when the next account reload fails', async () => {
  (auth.getStudentVerification as jest.Mock).mockResolvedValue({
    data: { status: 'VERIFIED', canContribute: true, email: 'alice@school.example' },
  });
  (auth.getAccountIdentities as jest.Mock).mockResolvedValue({
    data: { phone: '+8613800138000', wechat: {} },
  });
  const wrapper = await page();
  expect(wrapper.text()).toContain('alice@school.example');
  expect(wrapper.text()).toContain('+8613800138000');
  (auth.getStudentVerification as jest.Mock).mockRejectedValue(new Error('unavailable'));
  (auth.getAccountIdentities as jest.Mock).mockRejectedValue(new Error('unavailable'));
  user.sessionVersion++;
  user.userInfo = { id: 'bob' };
  await flushPromises();
  expect(wrapper.text()).not.toContain('alice@school.example');
  expect(wrapper.text()).not.toContain('+8613800138000');
  expect(wrapper.text()).not.toContain('在校学生');
  expect(wrapper.text()).toContain('部分身份信息读取失败');
});

test('a late identity read cannot replace the new account data', async () => {
  let finish!: (value: any) => void;
  (auth.getAccountIdentities as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const wrapper = shallowMount(Identity);
  wrappers.push(wrapper);
  const initialLoad = (onShow as jest.Mock).mock.calls.slice(-1)[0][0]();
  (auth.getAccountIdentities as jest.Mock).mockResolvedValue({
    data: { phone: '+8613900139000', wechat: {} },
  });
  user.sessionVersion++;
  user.userInfo = { id: 'bob' };
  await flushPromises();
  finish({ data: { phone: '+8613800138000', wechat: {} } });
  await initialLoad;
  await flushPromises();
  expect(wrapper.text()).toContain('+8613900139000');
  expect(wrapper.text()).not.toContain('+8613800138000');
});
