import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import Page from '@/pages/notifications/index.vue';
import {
  getNotifications,
  getUnreadNotificationCount,
  readAllNotifications,
  readNotification,
} from '@/api/modules/notifications';
import { useUserStore } from '@/store/modules/use-user-store';
jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/api/modules/notifications', () => ({
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  readAllNotifications: jest.fn(),
  readNotification: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
const message = (id = 'N') => ({
  id,
  type: 'like',
  actor: { id: 'B', nickname: '小李', avatar: '' },
  targetType: 'review',
  targetId: 'review',
  dishId: 'dish',
  rootId: null,
  readAt: null,
  createdAt: '2026-10-09T00:00:00Z',
});
const inbox = (items = [message()], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items, meta: { page, totalPages } },
});
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(yes => {
    resolve = yes;
  });
  return { resolve, promise };
};
const wrappers: any[] = [];
let user: any;
beforeEach(() => {
  jest.clearAllMocks();
  user = reactive({ isLoggedIn: true, sessionVersion: 0 });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (getNotifications as jest.Mock).mockResolvedValue(inbox());
  (getUnreadNotificationCount as jest.Mock).mockResolvedValue({
    code: 200,
    data: { unreadCount: 1 },
  });
  (readAllNotifications as jest.Mock).mockResolvedValue({ code: 200 });
  (readNotification as jest.Mock).mockResolvedValue({ code: 200 });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
async function page() {
  const wrapper = mount(Page);
  wrappers.push(wrapper);
  (onShow as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  return wrapper;
}

test('shows genuine inbox entries and marks a message before its exact deep link', async () => {
  const wrapper = await page();
  expect(wrapper.text()).toContain('小李 赞了你的评价');
  expect(wrapper.find('.notification-dot').exists()).toBe(true);
  await wrapper.get('.notification-item').trigger('click');
  await flushPromises();
  expect(readNotification).toHaveBeenCalledWith('N');
  expect(uni.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/dish/index?id=dish&reviewId=review' })
  );
  expect(wrapper.find('.notification-dot').exists()).toBe(false);
});
test('a session change clears the inbox and suppresses late message navigation', async () => {
  const wrapper = await page();
  const late = deferred();
  (readNotification as jest.Mock).mockReturnValue(late.promise);
  await wrapper.get('.notification-item').trigger('click');
  user.isLoggedIn = false;
  user.sessionVersion++;
  late.resolve({ code: 200 });
  await flushPromises();
  expect(wrapper.find('.notification-item').exists()).toBe(false);
  expect(wrapper.text()).toContain('登录后查看消息');
  expect(uni.navigateTo).not.toHaveBeenCalled();
});
test('a stale refresh after mark-all is re-read without resurrecting unread status', async () => {
  const wrapper = await page();
  const late = deferred();
  (getNotifications as jest.Mock)
    .mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce(inbox([{ ...message(), readAt: '2026-10-09T01:00:00Z' } as any]));
  (getUnreadNotificationCount as jest.Mock).mockResolvedValue({
    code: 200,
    data: { unreadCount: 0 },
  });
  const refresh = (onPullDownRefresh as jest.Mock).mock.calls.slice(-1)[0][0]();
  await wrapper.get('.notifications-heading button').trigger('click');
  await flushPromises();
  late.resolve(inbox());
  await refresh;
  await flushPromises();
  expect(getNotifications).toHaveBeenCalledTimes(3);
  expect(wrapper.find('.notification-dot').exists()).toBe(false);
});
test('failure preserves entries and offers retry, while hidden pages ignore the result', async () => {
  const wrapper = await page();
  (getNotifications as jest.Mock).mockRejectedValueOnce(new Error('连接失败'));
  await (onPullDownRefresh as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  expect(wrapper.find('.notification-item').exists()).toBe(true);
  expect(wrapper.text()).toContain('连接失败');
  const late = deferred();
  (getNotifications as jest.Mock).mockReturnValueOnce(late.promise);
  const refresh = (onPullDownRefresh as jest.Mock).mock.calls.slice(-1)[0][0]();
  (onHide as jest.Mock).mock.calls.slice(-1)[0][0]();
  late.resolve(inbox([message('late')]));
  await refresh;
  await flushPromises();
  expect(wrapper.find('.notification-item').attributes('aria-label')).toContain('小李');
  expect((wrapper.vm as any).items[0].id).toBe('N');
});
test('guests see a login action and never make inbox requests', async () => {
  user.isLoggedIn = false;
  const wrapper = await page();
  expect(getNotifications).not.toHaveBeenCalled();
  await wrapper.get('.empty-state__action').trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/login/index' });
});
