import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LoginForm from '@/pages/login/components/LoginForm.vue';
import { getAuthCapabilities } from '@/api/modules/auth';
import { saveCampusLoginPending } from '@/utils/campus-login';

jest.mock('@dcloudio/uni-app', () => ({ onShow: jest.fn() }));

jest.mock('@/api/modules/auth', () => ({
  ...jest.requireActual('@/api/modules/auth'),
  getAuthCapabilities: jest.fn(),
}));

const mockWechatLogin = jest.fn();
const mockCampusLogin = jest.fn();
let mockWechatAvailable = true;
let mockWechatProviderPending = false;
jest.mock('@/pages/login/composables/use-login', () => ({
  useLogin: () => ({
    loading: require('vue').ref(false),
    submitted: require('vue').ref(false),
    wechatAvailable: require('vue').ref(mockWechatAvailable),
    wechatProviderLoading: require('vue').ref(mockWechatProviderPending),
    wechatLogin: mockWechatLogin,
    campusLogin: mockCampusLogin,
    testLoginEnabled: false,
  }),
}));

const mountForm = () =>
  mount(LoginForm, {
    global: {
      stubs: {
        'checkbox-group': {
          name: 'checkbox-group',
          template: '<div><slot /></div>',
          emits: ['change'],
        },
        checkbox: {
          props: ['checked', 'value'],
          template: '<input type="checkbox" :checked="checked" :value="value" />',
        },
      },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockWechatAvailable = true;
  mockWechatProviderPending = false;
  setActivePinia(createPinia());
  (getAuthCapabilities as jest.Mock).mockResolvedValue({
    code: 200,
    data: { phone: false, wechatMiniapp: true, wechatApp: true },
  });
  mockWechatLogin.mockResolvedValue(undefined);
});

test('agreement is unchecked initially and the consent control gates login', async () => {
  const wrapper = mountForm();
  await flushPromises();
  await wrapper.get('.login-button').trigger('click');
  expect(mockWechatLogin).not.toHaveBeenCalled();
  expect(wrapper.find('label').text()).toContain('我已同意');
  expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false);

  wrapper
    .findComponent({ name: 'checkbox-group' })
    .vm.$emit('change', { detail: { value: ['agreed'] } });
  await wrapper.vm.$nextTick();
  expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
  await wrapper.get('.login-button').trigger('click');
  await flushPromises();
  expect(mockWechatLogin).toHaveBeenCalledTimes(1);
  expect(wrapper.emitted('loginSuccess')).toHaveLength(1);

  wrapper.findComponent({ name: 'checkbox-group' }).vm.$emit('change', { detail: { value: [] } });
  await wrapper.vm.$nextTick();
  await wrapper.get('.login-button').trigger('click');
  expect(mockWechatLogin).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});

test('opening a policy does not implicitly grant consent', async () => {
  const wrapper = mountForm();
  await flushPromises();
  const policy = wrapper.findAll('text, span').find(node => node.text() === '《隐私政策》')!;
  await policy.trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/settings/privacy?type=privacy' });
  await wrapper.get('.login-button').trigger('click');
  expect(mockWechatLogin).not.toHaveBeenCalled();
  wrapper.unmount();
});

test('phone is optional and absent from the default WeChat login form', async () => {
  const wrapper = mountForm();
  await flushPromises();
  expect(wrapper.find('.phone-login').exists()).toBe(false);
  expect(wrapper.get('.login-button').text()).toBe('微信一键登录');
  wrapper.unmount();
});

test('shows loading while the native provider is still being discovered', async () => {
  mockWechatAvailable = false;
  mockWechatProviderPending = true;
  const wrapper = mountForm();
  await flushPromises();
  expect(wrapper.get('[role="status"]').text()).toContain('正在读取登录方式');
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  wrapper.unmount();
});

test('shows a recovery state when no login methods are available', async () => {
  (getAuthCapabilities as jest.Mock).mockResolvedValue({
    code: 200,
    data: { phone: false, wechatMiniapp: false, wechatApp: false },
  });
  const wrapper = mountForm();
  await flushPromises();
  expect(wrapper.find('.login-button').exists()).toBe(false);
  expect(wrapper.get('[role="alert"]').text()).toContain('暂时无法登录');
  expect(wrapper.find('.login-agreement').exists()).toBe(false);
  expect(wrapper.findAll('button').some(button => button.text() === '先逛逛')).toBe(true);
  (getAuthCapabilities as jest.Mock).mockResolvedValue({
    code: 200,
    data: { phone: false, wechatMiniapp: true, wechatApp: true },
  });
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  expect(wrapper.get('.login-button').text()).toBe('微信一键登录');
  expect(wrapper.find('.login-agreement').exists()).toBe(true);
  wrapper.unmount();
});

test('shows campus OAuth only as a configured login method and requires consent before authorization', async () => {
  (getAuthCapabilities as jest.Mock).mockResolvedValue({
    data: {
      phone: false,
      wechatMiniapp: false,
      wechatApp: false,
      campusOAuth: false,
      loginMethods: { phone: false, wechatMiniapp: false, wechatApp: false, campusOAuth: true },
      verificationMethods: { campusEmail: true, campusOAuth: false },
    },
  });
  const wrapper = mountForm();
  await flushPromises();
  expect(wrapper.get('.campus-login .login-button').text()).toBe('校园账号登录');
  expect(wrapper.find('.error-feedback').exists()).toBe(false);
  await wrapper.get('.campus-login .login-button').trigger('click');
  expect(uni.showToast).toHaveBeenCalledWith({ title: '请先同意用户协议和隐私政策', icon: 'none' });
  wrapper.unmount();
});

describe('campus login confirmation recovery', () => {
  const storage = new Map<string, string>();
  let wrapper: ReturnType<typeof mountForm>;
  let expiresAt: number;

  beforeEach(async () => {
    storage.clear();
    jest.spyOn(uni, 'getStorageSync').mockImplementation(key => storage.get(key));
    jest.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
      storage.set(key, value);
    });
    jest.spyOn(uni, 'removeStorageSync').mockImplementation(key => {
      storage.delete(key);
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCampusLogin.mockResolvedValue(undefined);
    (getAuthCapabilities as jest.Mock).mockResolvedValue({
      data: {
        loginMethods: { phone: false, wechatMiniapp: false, wechatApp: false, campusOAuth: true },
      },
    });
    expiresAt = Date.now() + 60000;
    saveCampusLoginPending({
      attemptId: 'attempt',
      authorizationUrl: 'https://school.example/authorize',
      loginVerifier: 'v'.repeat(43),
      expiresAt: new Date(expiresAt).toISOString(),
    });
    wrapper = mountForm();
    await flushPromises();
    wrapper
      .findComponent({ name: 'checkbox-group' })
      .vm.$emit('change', { detail: { value: ['agreed'] } });
    await wrapper.vm.$nextTick();
  });

  afterEach(() => {
    wrapper.unmount();
    jest.restoreAllMocks();
  });

  async function confirm(code: string) {
    await wrapper.get('[aria-label="校园登录确认码"]').setValue(code);
    await wrapper
      .findAll('button')
      .find(button => button.text() === '确认登录')!
      .trigger('click');
    await flushPromises();
  }

  test('shows expiry and removes the stale form when a ticket expires after rendering', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(expiresAt + 1);
    await confirm('c'.repeat(43));
    expect(wrapper.get('.campus-login [role="alert"]').text()).toContain('本次登录已过期');
    expect(wrapper.find('[aria-label="校园登录确认码"]').exists()).toBe(false);
    expect(wrapper.get('.campus-login .login-button').attributes('disabled')).toBeUndefined();
    expect(mockCampusLogin).not.toHaveBeenCalled();
    expect(wrapper.emitted('loginSuccess')).toBeUndefined();
  });

  test('retains a valid attempt for code correction and clears the error on retry', async () => {
    await confirm('!'.repeat(43));
    expect(wrapper.get('.campus-login [role="alert"]').text()).toContain('完整确认码');
    expect(mockCampusLogin).not.toHaveBeenCalled();
    expect(wrapper.emitted('loginSuccess')).toBeUndefined();

    await confirm('c'.repeat(43));
    expect(mockCampusLogin).toHaveBeenCalledWith({
      attemptId: 'attempt',
      loginVerifier: 'v'.repeat(43),
      handoffCode: 'c'.repeat(43),
    });
    expect(wrapper.find('.campus-login [role="alert"]').exists()).toBe(false);
    expect(wrapper.emitted('loginSuccess')).toHaveLength(1);
  });
});
