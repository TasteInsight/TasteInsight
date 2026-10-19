import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import Page from '@/pages/notifications/index.vue';
import FloatingActionButton from '@/components/FloatingActionButton.vue';
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
  expect(wrapper.findComponent(FloatingActionButton).exists()).toBe(false);
});

test('service messages pair a concise event title with the actual dish subject', async () => {
  (getNotifications as jest.Mock).mockResolvedValue(
    inbox([
      {
        ...message('approved'),
        actor: null,
        type: 'upload_approved',
        targetType: 'dish_upload',
        subject: '番茄炖牛肉',
      },
      { ...message('new'), actor: null, type: 'new_dish', targetType: 'dish', subject: null },
    ] as any)
  );
  const wrapper = await page();
  const rows = wrapper.findAll('.notification-item');
  expect(rows[0].get('.notification-copy').text()).toBe('菜品资料已采纳');
  expect(rows[0].get('.notification-subject').text()).toBe('番茄炖牛肉');
  expect(rows[0].attributes('aria-label')).toBe('你提交的菜品资料已采纳，番茄炖牛肉，未读');
  expect(rows[0].find('.notification-summary .notification-date').exists()).toBe(true);
  expect(rows[0].get('.notification-system .ui-icon').attributes('src')).toBe(
    '/static/icons/ui/shield-primary.png'
  );
  expect(rows[1].get('.notification-copy').text()).toBe('食堂上新');
  expect(rows[1].find('.notification-subject').exists()).toBe(false);
  expect(rows[1].get('.notification-system .ui-icon').attributes('src')).toBe(
    '/static/icons/ui/plus-muted.png'
  );
});

test('an empty failed inbox uses the shared retry state without a disabled toolbar', async () => {
  (getNotifications as jest.Mock).mockRejectedValueOnce(new Error('连接失败，请重试'));
  const wrapper = await page();
  expect(wrapper.findComponent(FloatingActionButton).exists()).toBe(false);
  expect(wrapper.findAll('.error-feedback')).toHaveLength(1);
  expect(wrapper.text()).not.toContain('暂无新消息');
  expect(wrapper.get('.error-feedback__message').text()).toBe('连接失败，请重试');
  expect(wrapper.get('.error-feedback__action').text()).toBe('重新加载');
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(getNotifications).toHaveBeenCalledTimes(2);
  expect(wrapper.find('.notification-item').exists()).toBe(true);
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
  wrapper.getComponent(FloatingActionButton).vm.$emit('click');
  await flushPromises();
  late.resolve(inbox());
  await refresh;
  await flushPromises();
  expect(getNotifications).toHaveBeenCalledTimes(3);
  expect(wrapper.find('.notification-dot').exists()).toBe(false);
});

test('the floating read-all action appears only for unread messages and disappears after success', async () => {
  const wrapper = await page();
  const action = wrapper.getComponent(FloatingActionButton);
  expect(action.props()).toMatchObject({ icon: 'eye', label: '全部已读', disabled: false });
  action.vm.$emit('click');
  await flushPromises();
  expect(readAllNotifications).toHaveBeenCalledTimes(1);
  expect(wrapper.findComponent(FloatingActionButton).exists()).toBe(false);
  expect(wrapper.find('.notification-dot').exists()).toBe(false);
});

test('an already-read inbox has no floating read-all action', async () => {
  (getNotifications as jest.Mock).mockResolvedValue(
    inbox([{ ...message(), readAt: '2026-10-09T01:00:00Z' } as any])
  );
  (getUnreadNotificationCount as jest.Mock).mockResolvedValue({
    code: 200,
    data: { unreadCount: 0 },
  });
  const wrapper = await page();
  expect(wrapper.findComponent(FloatingActionButton).exists()).toBe(false);
});

test('read-all ignores repeat clicks and restores the floating action after failure', async () => {
  const wrapper = await page();
  const late = deferred();
  (readAllNotifications as jest.Mock).mockReturnValueOnce(late.promise);
  const action = wrapper.getComponent(FloatingActionButton);
  action.vm.$emit('click');
  action.vm.$emit('click');
  await flushPromises();
  expect(readAllNotifications).toHaveBeenCalledTimes(1);
  expect(action.props()).toMatchObject({ label: '标记中…', disabled: true });
  late.resolve({ code: 500, message: '标记失败，请重试' });
  await flushPromises();
  expect(wrapper.getComponent(FloatingActionButton).props()).toMatchObject({
    label: '全部已读',
    disabled: false,
  });
  expect(wrapper.find('.notification-dot').exists()).toBe(true);
  expect(uni.showToast).toHaveBeenCalledWith({ title: '标记失败，请重试', icon: 'none' });
  wrapper.getComponent(FloatingActionButton).vm.$emit('click');
  await flushPromises();
  expect(readAllNotifications).toHaveBeenCalledTimes(2);
  expect(wrapper.findComponent(FloatingActionButton).exists()).toBe(false);
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
  expect(uni.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/login/index' })
  );
});
