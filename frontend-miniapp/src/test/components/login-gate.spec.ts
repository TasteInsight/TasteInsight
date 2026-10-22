import { mount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import LoginGate from '@/components/LoginGate.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { openLogin } from '@/utils/login-navigation';

jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/utils/login-navigation', () => ({ openLogin: jest.fn() }));

test('a private area mounts only after login and keeps an explicit login action', async () => {
  const user = reactive({ isLoggedIn: false });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  const wrapper = mount(LoginGate, {
    props: { title: '登录后查看我的动态' },
    slots: { default: '<div data-private>个人内容</div>' },
  });
  expect(wrapper.find('[data-private]').exists()).toBe(false);
  await wrapper.get('button').trigger('click');
  expect(openLogin).toHaveBeenCalledTimes(1);
  user.isLoggedIn = true;
  await nextTick();
  expect(wrapper.find('[data-private]').exists()).toBe(true);
  expect(wrapper.find('.empty-state').exists()).toBe(false);
  user.isLoggedIn = false;
  await nextTick();
  expect(wrapper.find('[data-private]').exists()).toBe(false);
  await wrapper.setProps({ required: false });
  expect(wrapper.find('[data-private]').exists()).toBe(true);
  wrapper.unmount();
});
