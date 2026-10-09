import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { onShow } from '@dcloudio/uni-app';
import { getUserProfile, updateUserProfile } from '@/api/modules/user';
import { getCanteenList } from '@/api/modules/canteen';
import PersonalPage from '@/pages/settings/components/personal.vue';
import DisplayPage from '@/pages/settings/components/display.vue';
import PreferencesPage from '@/pages/settings/components/preferences.vue';
import NotificationsPage from '@/pages/settings/components/notifications.vue';
import AllergensPage from '@/pages/settings/components/allergens.vue';
import ProfilePage from '@/pages/profile/index.vue';
import UserHeader from '@/pages/profile/components/UserHeader.vue';

jest.mock('@dcloudio/uni-app', () => ({
  onBackPress: jest.fn(),
  onShow: jest.fn(),
  onPullDownRefresh: jest.fn(),
}));
jest.mock('@/api/modules/user', () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
}));
jest.mock('@/api/modules/canteen', () => ({ getCanteenList: jest.fn() }));

const user = { id: 'owner', nickname: '真实昵称', avatar: '', preferences: {}, allergens: [] };
const storage = new Map<string, unknown>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  storage.clear();
  storage.set('token', 'test-token');
  Object.assign(uni, {
    getStorageSync: jest.fn(key => storage.get(key)),
    setStorageSync: jest.fn((key, value) => storage.set(key, value)),
    removeStorageSync: jest.fn(key => storage.delete(key)),
    showToast: jest.fn(),
  });
  setActivePinia(createPinia());
  (getUserProfile as jest.Mock).mockImplementation(() => new Promise(() => {}));
  (getCanteenList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { totalPages: 0 } },
  });
});

it.each([
  ['personal', PersonalPage],
  ['display', DisplayPage],
  ['preferences', PreferencesPage],
  ['notifications', NotificationsPage],
  ['allergens', AllergensPage],
] as const)('%s keeps a blank data area until its profile read succeeds', (_name, Page) => {
  const wrapper = mount(Page as any);
  expect(wrapper.findAll('.page-content')).toHaveLength(1);
  expect(wrapper.find('.skeleton-item').exists()).toBe(false);
  expect(wrapper.get('.settings-form-body').text()).toBe('');
  expect(wrapper.find('.settings-section').exists()).toBe(false);
  expect(wrapper.find('.settings-load-error').exists()).toBe(false);
  expect(wrapper.find('.settings-save-bar').exists()).toBe(false);
  expect(updateUserProfile).not.toHaveBeenCalled();
  wrapper.unmount();
});

it('renders a successful profile immediately and keeps the page frame', async () => {
  const response = deferred<any>();
  (getUserProfile as jest.Mock).mockReturnValue(response.promise);
  const wrapper = mount(PersonalPage);
  const frame = wrapper.get('.page-content').element;
  response.resolve({ code: 200, data: user });
  await flushPromises();
  expect(wrapper.get('.page-content').element).toBe(frame);
  expect(wrapper.get('input').element.value).toBe(user.nickname);
  expect(wrapper.get('input').attributes('disabled')).toBeUndefined();
  expect(wrapper.find('.skeleton-item').exists()).toBe(false);
  expect(wrapper.find('.settings-save-bar').exists()).toBe(true);
  wrapper.unmount();
});

it('keeps failed initialization noneditable and offers a successful retry', async () => {
  const response = deferred<any>();
  (getUserProfile as jest.Mock).mockReturnValueOnce(response.promise);
  const wrapper = mount(PersonalPage);
  response.reject(new Error('请求超时，请重试'));
  await flushPromises();
  expect(wrapper.get('.settings-load-error').text()).toContain('请求超时，请重试');
  expect(wrapper.find('input').exists()).toBe(false);
  expect(wrapper.find('.settings-save-bar').exists()).toBe(false);
  expect(updateUserProfile).not.toHaveBeenCalled();
  (getUserProfile as jest.Mock).mockResolvedValueOnce({ code: 200, data: user });
  await wrapper.get('.settings-load-error button').trigger('click');
  await flushPromises();
  expect(wrapper.get('input').element.value).toBe(user.nickname);
  expect(wrapper.find('.settings-load-error').exists()).toBe(false);
  wrapper.unmount();
});

it('keeps profile menus mounted without an unread signed-in profile header', async () => {
  const response = deferred<any>();
  (getUserProfile as jest.Mock).mockReturnValue(response.promise);
  const wrapper = mount(ProfilePage);
  expect(wrapper.findComponent(UserHeader).exists()).toBe(false);
  expect(wrapper.findAll('.profile-menu')).toHaveLength(6);
  const show = (onShow as jest.Mock).mock.calls[0][0];
  show();
  await flushPromises();
  expect(wrapper.findAll('.profile-menu')).toHaveLength(6);
  expect(wrapper.find('.skeleton-item').exists()).toBe(false);
  response.resolve({ code: 200, data: user });
  await flushPromises();
  expect(wrapper.getComponent(UserHeader).props('userInfo')).toMatchObject({ nickname: user.nickname });
  wrapper.unmount();
});

it('retains a cached account profile during a failed background refresh', async () => {
  storage.set('userInfo', JSON.stringify(user));
  const response = deferred<any>();
  (getUserProfile as jest.Mock).mockReturnValue(response.promise);
  const wrapper = mount(ProfilePage);
  const header = wrapper.getComponent(UserHeader).element;
  const show = (onShow as jest.Mock).mock.calls[0][0];
  show();
  await flushPromises();
  expect(wrapper.getComponent(UserHeader).element).toBe(header);
  expect(wrapper.getComponent(UserHeader).props('userInfo')).toMatchObject({ nickname: user.nickname });
  response.reject(new Error('请求超时，请重试'));
  await flushPromises();
  expect(wrapper.getComponent(UserHeader).element).toBe(header);
  expect(wrapper.get('.profile-error').text()).toContain('请求超时，请重试');
  expect(wrapper.findAll('.profile-menu')).toHaveLength(6);
  wrapper.unmount();
});
