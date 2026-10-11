import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LoginForm from '@/pages/login/components/LoginForm.vue';
import { getAuthCapabilities } from '@/api/modules/auth';

jest.mock('@/api/modules/auth', () => ({
  ...jest.requireActual('@/api/modules/auth'),
  getAuthCapabilities: jest.fn(),
}));

const mockWechatLogin = jest.fn();
jest.mock('@/pages/login/composables/use-login', () => ({
  useLogin: () => ({ loading: require('vue').ref(false), submitted: require('vue').ref(false), wechatAvailable: require('vue').ref(true), wechatLogin: mockWechatLogin, testLoginEnabled:false }),
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
