import { flushPromises, shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onBackPress, onHide, onReachBottom, onShow } from '@dcloudio/uni-app';
import ProfilePage from '@/pages/profile/index.vue';
import UserHeader from '@/pages/profile/components/UserHeader.vue';
import ProfileBioEditor from '@/pages/profile/components/ProfileBioEditor.vue';
import ProfileActionsSheet from '@/pages/profile/components/ProfileActionsSheet.vue';
import EmptyState from '@/components/EmptyState.vue';
import ProfilePostCard from '@/pages/profile/components/ProfilePostCard.vue';
import ReviewCard from '@/pages/profile/my-reviews/components/ReviewCard.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getMyReviews } from '@/api/modules/user';
import { getPosts } from '@/api/modules/social';
import { getUnreadNotificationCount } from '@/api/modules/notifications';

jest.mock('@dcloudio/uni-app', () => ({
  onPullDownRefresh: jest.fn(),
  onShow: jest.fn(),
  onHide: jest.fn(),
  onReachBottom: jest.fn(),
  onBackPress: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/api/modules/user', () => ({ getMyReviews: jest.fn() }));
jest.mock('@/api/modules/social', () => ({ getPosts: jest.fn() }));
jest.mock('@/api/modules/notifications', () => ({ getUnreadNotificationCount: jest.fn() }));
jest.mock('@/utils/student-access', () => ({ requireStudent: jest.fn(() => true) }));

const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<any>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
};
const pageResult = (items: any[] = [], page = 1, totalPages = 0) => ({
  code: 200,
  data: { items, meta: { page, totalPages } },
});
let user: any;
const wrappers: any[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(uni, { showActionSheet: jest.fn() });
  user = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: {
      id: 'A',
      nickname: '同学A',
      bio: '喜欢家常菜',
      capabilities: { canContribute: true },
    },
    fetchProfileAction: jest.fn().mockResolvedValue(undefined),
    updateProfileAction: jest.fn().mockResolvedValue(undefined),
    logoutAction: jest.fn(),
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (getPosts as jest.Mock).mockResolvedValue(pageResult());
  (getMyReviews as jest.Mock).mockResolvedValue(pageResult());
  (getUnreadNotificationCount as jest.Mock).mockResolvedValue({
    code: 200,
    data: { unreadCount: 0 },
  });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
function mountPage() {
  const wrapper = shallowMount(ProfilePage, {
    global: {
      stubs: {
        IconButton: false,
        ProfileActionsSheet: false,
        UserHeader: false,
        AsyncState: false,
        EmptyState: false,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
async function show() {
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
}

test('initial profile failure replaces dependent content without issuing another failing read', async () => {
  user.userInfo = null;
  user.fetchProfileAction.mockRejectedValueOnce(new Error('资料读取失败'));
  const wrapper = mountPage();
  await show();
  expect(wrapper.text()).toContain('资料读取失败');
  expect(wrapper.findAll('.error-feedback')).toHaveLength(1);
  expect(wrapper.find('.profile-tab-row').exists()).toBe(false);
  expect(wrapper.find('.profile-content').exists()).toBe(false);
  expect(getPosts).not.toHaveBeenCalled();
  expect(getMyReviews).not.toHaveBeenCalled();
  user.fetchProfileAction.mockImplementationOnce(async () => {
    user.userInfo = { id: 'A', nickname: '已恢复昵称' };
  });
  (getPosts as jest.Mock).mockResolvedValueOnce(pageResult([{ id: 'recovered-post' }]));
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(wrapper.find('.profile-tab-row').exists()).toBe(true);
  expect(wrapper.getComponent(UserHeader).props('userInfo')?.nickname).toBe('已恢复昵称');
  expect(getPosts).toHaveBeenCalledTimes(1);
  expect(wrapper.getComponent(ProfilePostCard).props('post').id).toBe('recovered-post');
});
async function tab(wrapper: any, name: string) {
  const target = wrapper.findAll('[role="tab"]').find((item: any) => item.text() === name);
  await target.trigger('click');
  await flushPromises();
}

test('keeps the tools and content tabs visible while an unread profile loads without false empty state', async () => {
  const pending = deferred();
  user.userInfo = null;
  user.fetchProfileAction.mockReturnValue(pending.promise);
  const wrapper = mountPage();
  await show();
  expect(wrapper.findComponent(UserHeader).exists()).toBe(false);
  expect(wrapper.findAll('[role="tab"]')).toHaveLength(3);
  expect(wrapper.find('[aria-label="设置"]').exists()).toBe(true);
  expect(wrapper.text()).toContain('正在加载个人资料…');
  expect(wrapper.text()).not.toContain('还没有动态');
  expect(wrapper.find('.campus-skeleton').exists()).toBe(false);
  expect(getPosts).not.toHaveBeenCalled();
  user.userInfo = { id: 'A', nickname: '已读取昵称' };
  pending.resolve(undefined);
  await flushPromises();
  expect(wrapper.getComponent(UserHeader).props('userInfo')?.nickname).toBe('已读取昵称');
  expect(wrapper.getComponent(EmptyState).props('title')).toBe('还没有动态');
});

test('guests have login and settings without private tools, tabs, or requests', async () => {
  user.isLoggedIn = false;
  user.userInfo = null;
  const wrapper = mountPage();
  await show();
  expect(wrapper.getComponent(UserHeader).props('isLoggedIn')).toBe(false);
  expect(wrapper.findAll('[role="tab"]')).toHaveLength(0);
  expect(wrapper.find('.profile-utilities').exists()).toBe(false);
  expect(wrapper.find('[aria-label="消息"]').exists()).toBe(false);
  expect(getPosts).not.toHaveBeenCalled();
  expect(getMyReviews).not.toHaveBeenCalled();
  expect(getUnreadNotificationCount).not.toHaveBeenCalled();
  expect(user.updateProfileAction).not.toHaveBeenCalled();
});

test('renders owned contributions including nonpublic posts without pending badges', async () => {
  (getPosts as jest.Mock).mockResolvedValue(
    pageResult([
      { id: 'approved', content: '公开动态', status: 'approved' },
      { id: 'pending', content: '本人未公开动态', status: 'pending' },
      { id: 'rejected', content: '待修改动态', status: 'rejected', rejectReason: '请补充用餐经历' },
    ])
  );
  const wrapper = mountPage();
  await show();
  expect(getPosts).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, true);
  expect(wrapper.findAllComponents(ProfilePostCard).map(card => card.props('post').id)).toEqual([
    'approved',
    'pending',
    'rejected',
  ]);
  expect(wrapper.findAllComponents(ProfilePostCard)[2].props('post')).toMatchObject({
    id: 'rejected',
    content: '待修改动态',
    status: 'rejected',
    rejectReason: '请补充用餐经历',
  });
  expect(wrapper.text()).not.toMatch(/待审核|已提交|退出登录|关于食鉴|校园动态与约饭/);
  expect(user.updateProfileAction).not.toHaveBeenCalled();
});

test('reviews use the existing review cards and retry an initial failure without claiming empty', async () => {
  (getMyReviews as jest.Mock).mockRejectedValueOnce(new Error('评价读取失败'));
  const wrapper = mountPage();
  await show();
  await tab(wrapper, '评价');
  expect(wrapper.text()).toContain('评价读取失败');
  expect(wrapper.findComponent(EmptyState).exists()).toBe(false);
  const review = { id: 'review', dishId: 'dish', dishName: '番茄炒蛋', content: '很下饭' };
  (getMyReviews as jest.Mock).mockResolvedValue(pageResult([review]));
  await wrapper.get('.profile-content .error-feedback__action').trigger('click');
  await flushPromises();
  expect(wrapper.getComponent(ReviewCard).props('review')).toEqual(review);
  wrapper.getComponent(ReviewCard).vm.$emit('click');
  expect(uni.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/dish/index?id=dish' })
  );
});

test('keeps loaded posts during a failed refresh and supports pagination', async () => {
  (getPosts as jest.Mock).mockResolvedValueOnce(
    pageResult([{ id: 'one', status: 'approved' }], 1, 2)
  );
  const wrapper = mountPage();
  await show();
  (getPosts as jest.Mock).mockRejectedValueOnce(new Error('网络中断'));
  (onReachBottom as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findAllComponents(ProfilePostCard)).toHaveLength(1);
  expect(wrapper.text()).toContain('网络中断');
  (getPosts as jest.Mock).mockResolvedValueOnce(
    pageResult([{ id: 'two', status: 'approved' }], 2, 2)
  );
  await wrapper.get('.profile-content .error-feedback__action').trigger('click');
  await flushPromises();
  expect(getPosts).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 }, true);
  expect(wrapper.findAllComponents(ProfilePostCard)).toHaveLength(2);
});

test('account switching clears content immediately and rejects the old account response', async () => {
  const oldPosts = deferred();
  (getPosts as jest.Mock).mockReturnValueOnce(oldPosts.promise);
  const wrapper = mountPage();
  await show();
  (getPosts as jest.Mock).mockResolvedValueOnce(pageResult([{ id: 'B-post', status: 'approved' }]));
  user.userInfo = { id: 'B', nickname: '同学B' };
  user.sessionVersion++;
  await flushPromises();
  oldPosts.resolve(pageResult([{ id: 'A-private', status: 'pending' }]));
  await flushPromises();
  expect(wrapper.findAllComponents(ProfilePostCard).map(card => card.props('post').id)).toEqual([
    'B-post',
  ]);
});

test('hiding a page invalidates in-flight posts and unread badges', async () => {
  const posts = deferred();
  const unread = deferred();
  (getPosts as jest.Mock).mockReturnValue(posts.promise);
  (getUnreadNotificationCount as jest.Mock).mockReturnValue(unread.promise);
  const wrapper = mountPage();
  await show();
  (onHide as jest.Mock).mock.calls[0][0]();
  posts.resolve(pageResult([{ id: 'hidden-post', status: 'pending' }]));
  unread.resolve({ code: 200, data: { unreadCount: 8 } });
  await flushPromises();
  expect(wrapper.findAllComponents(ProfilePostCard)).toHaveLength(0);
  expect(wrapper.find('.profile-unread').exists()).toBe(false);
});

test('content tabs and toolbar actions activate once from the keyboard', async () => {
  const wrapper = mountPage();
  await show();
  const reviews = wrapper.findAll('[role="tab"]').find(item => item.text() === '评价')!;
  await reviews.trigger('keydown', { key: 'Enter' });
  await reviews.trigger('keyup', { key: 'Enter' });
  await flushPromises();
  expect(getMyReviews).toHaveBeenCalledTimes(1);
  expect(reviews.attributes('aria-selected')).toBe('true');
  const settings = wrapper.get('[aria-label="设置"]');
  await settings.trigger('keydown', { key: ' ' });
  await settings.trigger('keyup', { key: ' ' });
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  expect(uni.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/settings/index' })
  );
});

test('closing the biography editor leaves no page-level back interceptor behind', async () => {
  const wrapper = shallowMount(ProfilePage, { global: { stubs: { ProfileBioEditor: false } } });
  wrappers.push(wrapper);
  wrapper.getComponent(UserHeader).vm.$emit('manage');
  await flushPromises();
  wrapper.getComponent(ProfileActionsSheet).vm.$emit('select', 1);
  await flushPromises();
  const editor = wrapper.getComponent(ProfileBioEditor);
  editor.vm.$emit('close');
  await flushPromises();
  expect(wrapper.findComponent(ProfileBioEditor).exists()).toBe(false);
  expect((onBackPress as jest.Mock).mock.calls.some(([hook]) => hook() === true)).toBe(false);
});

test('keeps tools beside identity and only one compose action in the content tab row', async () => {
  const wrapper = mountPage();
  await show();
  expect(wrapper.find('.profile-toolbar').exists()).toBe(false);
  expect(wrapper.get('.profile-header').findComponent(UserHeader).exists()).toBe(true);
  expect(wrapper.get('.profile-header').find('[aria-label="设置"]').exists()).toBe(true);
  expect(wrapper.findAll('.profile-utilities button').map(button => button.text())).toEqual([
    '收藏',
    '历史',
    '上传',
  ]);
  expect(wrapper.find('.profile-manage').exists()).toBe(false);
  expect(wrapper.get('.profile-tab-row').find('[aria-label="写动态"]').exists()).toBe(true);
  expect(wrapper.findAll('[aria-label="写动态"]')).toHaveLength(1);
  expect(wrapper.getComponent(EmptyState).props('actionText')).toBe('');
});

test('the compact profile menu retains editing, identity and visitor preview without changing privacy', async () => {
  const wrapper = mountPage();
  await show();
  for (const [index, url] of [
    [0, '/pages/settings/components/personal'],
    [2, '/pages/profile/identity'],
    [3, '/pages/profile/public?id=A'],
  ] as const) {
    await wrapper.get('.user-summary').trigger('click');
    const menu = wrapper.getComponent(ProfileActionsSheet);
    expect(menu.props('items')).toEqual(['头像与昵称', '个人简介', '账号与校园身份', '访客预览']);
    menu.vm.$emit('select', index);
    await flushPromises();
    expect(uni.navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url }));
    expect(wrapper.findComponent(ProfileActionsSheet).exists()).toBe(false);
  }
  await wrapper.get('.user-summary').trigger('click');
  wrapper.getComponent(ProfileActionsSheet).vm.$emit('select', 1);
  await flushPromises();
  expect(wrapper.findComponent(ProfileBioEditor).exists()).toBe(true);
  expect(user.updateProfileAction).not.toHaveBeenCalled();
});

test('an old profile menu cannot open the previous account after a session change', async () => {
  const wrapper = mountPage();
  await show();
  await wrapper.get('.user-summary').trigger('click');
  const select = (wrapper.getComponent(ProfileActionsSheet).vm.$.vnode.props as any).onSelect;
  user.userInfo = { id: 'B', nickname: '同学B' };
  user.sessionVersion++;
  select(3);
  select(1);
  await flushPromises();
  expect(uni.navigateTo).not.toHaveBeenCalled();
  expect(wrapper.findComponent(ProfileBioEditor).exists()).toBe(false);
});

test('keyboard profile management opens a focusable local dialog instead of the H5 native action sheet', async () => {
  const wrapper = mountPage();
  document.body.appendChild(wrapper.element);
  const trigger = wrapper.get('.user-summary');
  (trigger.element as HTMLElement).focus();
  await trigger.trigger('keydown', { key: 'Enter' });
  await trigger.trigger('keyup', { key: 'Enter' });
  await flushPromises();
  expect(wrapper.find('[role="dialog"][aria-label="个人资料"]').exists()).toBe(true);
  expect(uni.showActionSheet).not.toHaveBeenCalled();
  expect(document.activeElement?.textContent?.trim()).toBe('头像与昵称');
  const cancel = wrapper.get('.profile-actions-cancel');
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
  );
  expect(document.activeElement).toBe(cancel.element);
  await cancel.trigger('keydown', { key: ' ' });
  await cancel.trigger('keyup', { key: ' ' });
  await flushPromises();
  expect(wrapper.findComponent(ProfileActionsSheet).exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
  await trigger.trigger('click');
  await flushPromises();
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  );
  await flushPromises();
  expect(wrapper.findComponent(ProfileActionsSheet).exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
  await trigger.trigger('click');
  await flushPromises();
  const biography = wrapper.getComponent(ProfileActionsSheet).findAll('.profile-actions-option')[1];
  (biography.element as HTMLElement).focus();
  await biography.trigger('keydown', { key: ' ' });
  await biography.trigger('keyup', { key: ' ' });
  await flushPromises();
  expect(wrapper.findComponent(ProfileBioEditor).exists()).toBe(true);
  expect(wrapper.findComponent(ProfileActionsSheet).exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
});

test('page hiding closes profile actions and rejects a late selection without restoring hidden focus', async () => {
  const wrapper = mountPage();
  document.body.appendChild(wrapper.element);
  const trigger = wrapper.get('.user-summary');
  (trigger.element as HTMLElement).focus();
  await trigger.trigger('click');
  await flushPromises();
  const select = (wrapper.getComponent(ProfileActionsSheet).vm.$.vnode.props as any).onSelect;
  (onHide as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(ProfileActionsSheet).exists()).toBe(false);
  select(3);
  expect(uni.navigateTo).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(trigger.element);
});

test('the page back handler closes the local menu without leaving a back interceptor', async () => {
  const wrapper = mountPage();
  await wrapper.get('.user-summary').trigger('click');
  const back = (onBackPress as jest.Mock).mock.calls[0][0];
  expect(back()).toBe(true);
  await flushPromises();
  expect(wrapper.findComponent(ProfileActionsSheet).exists()).toBe(false);
  expect(back()).toBe(false);
});

test('owned posts show first loading feedback and preserve tabs', async () => {
  const pending = deferred();
  (getPosts as jest.Mock).mockReturnValueOnce(pending.promise);
  const wrapper = mountPage();
  await show();
  expect(wrapper.text()).toContain('正在加载动态…');
  expect(wrapper.findAll('[role="tab"]')).toHaveLength(3);
  expect(wrapper.text()).not.toContain('还没有动态');
  pending.resolve(pageResult());
  await flushPromises();
});
