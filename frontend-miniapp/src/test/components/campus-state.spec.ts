import { shallowMount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import PostFeed from '@/pages/community/components/PostFeed.vue';
import DiningInvites from '@/pages/planning/components/DiningInvites.vue';
import { getPosts } from '@/api/modules/social';
import { getDiningInvites, applyDiningInvite } from '@/api/modules/meal-plan';
import { useUserStore } from '@/store/modules/use-user-store';

jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/api/modules/social', () => ({ getPosts: jest.fn() }));
jest.mock('@/api/modules/meal-plan', () => ({
  getDiningInvites: jest.fn(),
  getDiningInvite: jest.fn(),
  applyDiningInvite: jest.fn(),
  decideDiningApplication: jest.fn(),
  withdrawDiningApplication: jest.fn(),
  cancelDiningInvite: jest.fn(),
}));
const postsPage = (ids: string[], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items: ids.map(id => ({ id, content: id })), meta: { page, totalPages } },
});
const invite = (id = 'invite') => ({
  id,
  host: { id: 'host', nickname: id },
  date: '2026-10-21',
  mealTime: 'lunch',
  startsAt: '2026-10-21T04:00:00Z',
  canteen: { name: '食堂' },
  capacity: 3,
  acceptedCount: 0,
  applications: [],
  status: 'open',
});
const diningPage = (ids: string[], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items: ids.map(id => invite(id)), meta: { page, totalPages } },
});
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => {
    resolve = done;
  });
  return { resolve, promise };
};
let user: {
  sessionVersion: number;
  isLoggedIn: boolean;
  userInfo: { id: string; capabilities: { canContribute: boolean } };
};
const wrappers: ReturnType<typeof shallowMount>[] = [];
function mountFeed(component: typeof PostFeed | typeof DiningInvites, props = {}) {
  const wrapper = shallowMount(component, {
    props,
    global: { stubs: { LoginGate: false, AsyncState: false, EmptyState: false } },
  });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  jest.clearAllMocks();
  (getPosts as jest.Mock).mockReset();
  (getDiningInvites as jest.Mock).mockReset();
  user = reactive({
    sessionVersion: 1,
    isLoggedIn: true,
    userInfo: { id: 'user', capabilities: { canContribute: true } },
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (getPosts as jest.Mock).mockResolvedValue(postsPage(['post']));
  (getDiningInvites as jest.Mock).mockResolvedValue(diningPage(['invite']));
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

test('guest selects my posts in place and login resumes that selection', async () => {
  user.isLoggedIn = false;
  const wrapper = mountFeed(PostFeed);
  await flushPromises();
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  expect(wrapper.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
  expect(wrapper.text()).toContain('登录后查看我的动态');
  expect(wrapper.findAll('post-card-stub')).toHaveLength(0);
  expect(uni.navigateTo).not.toHaveBeenCalled();
  expect(getPosts).toHaveBeenCalledTimes(1);
  await wrapper.get('.empty-state__action').trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/login/index' })
  );
  user.sessionVersion += 1;
  user.isLoggedIn = true;
  await flushPromises();
  expect(getPosts).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 }, true);
  expect(getPosts).toHaveBeenCalledTimes(2);
  expect(wrapper.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
});

test('post feed retains completed results and selection through inactive periods, while explicit refresh reloads', async () => {
  const wrapper = mountFeed(PostFeed);
  await flushPromises();
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(2);
  await wrapper.setProps({ active: false });
  await (wrapper.vm as any).refresh();
  await (wrapper.vm as any).loadMore();
  expect(getPosts).toHaveBeenCalledTimes(2);
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(2);
  expect(wrapper.findAll('post-card-stub')).toHaveLength(1);
  expect(wrapper.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
  await (wrapper.vm as any).refresh();
  expect(getPosts).toHaveBeenCalledTimes(3);
});

test('post account changes clear hidden private data and reload the selected feed only on activation', async () => {
  const wrapper = mountFeed(PostFeed);
  await flushPromises();
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  await flushPromises();
  await wrapper.setProps({ active: false });
  user.sessionVersion += 1;
  await flushPromises();
  expect(wrapper.findAll('post-card-stub')).toHaveLength(0);
  expect(getPosts).toHaveBeenCalledTimes(2);
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(getPosts).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 }, true);
  expect(getPosts).toHaveBeenCalledTimes(3);
});

test('an interrupted initial post load ignores its result and reloads on activation', async () => {
  const request = deferred();
  (getPosts as jest.Mock).mockReturnValueOnce(request.promise);
  const wrapper = mountFeed(PostFeed);
  expect(wrapper.text()).toContain('正在加载动态');
  await wrapper.setProps({ active: false });
  request.resolve(postsPage(['stale']));
  await flushPromises();
  expect(wrapper.findAll('post-card-stub')).toHaveLength(0);
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(2);
  expect(wrapper.find('post-card-stub').attributes('post')).toBeDefined();
});

test('dining keeps its selected list across visibility changes and a same-tab click', async () => {
  const wrapper = mountFeed(DiningInvites);
  await flushPromises();
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(2);
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  await wrapper.setProps({ active: false });
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(2);
  expect(wrapper.findAll('.dining-invite')).toHaveLength(1);
  expect(wrapper.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
});

test('logout removes dining content and pagination, then failed login load retries page one', async () => {
  (getDiningInvites as jest.Mock)
    .mockResolvedValueOnce(diningPage(['one'], 1, 3))
    .mockRejectedValueOnce(new Error('追加失败'))
    .mockRejectedValueOnce(new Error('新账号加载失败'))
    .mockResolvedValueOnce(diningPage([]));
  const wrapper = mountFeed(DiningInvites);
  await flushPromises();
  await (wrapper.vm as any).loadMore();
  await flushPromises();
  user.isLoggedIn = false;
  user.sessionVersion += 1;
  await flushPromises();
  expect(wrapper.text()).toContain('登录后查看约饭邀请');
  expect(wrapper.findAll('.dining-invite')).toHaveLength(0);
  expect(wrapper.find('.dining-more').exists()).toBe(false);
  expect(wrapper.find('.error-feedback').exists()).toBe(false);
  user.isLoggedIn = true;
  user.sessionVersion += 1;
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(3);
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(getDiningInvites).toHaveBeenLastCalledWith(false, 1);
  expect(wrapper.text()).toContain('暂时没有可加入的邀请');
});

test.each([
  ['posts', PostFeed, getPosts],
  ['dining', DiningInvites, getDiningInvites],
] as const)(
  '%s merges session recovery and activation into one initial attempt, including failure',
  async (_name, component, api) => {
    user.isLoggedIn = false;
    const wrapper = mountFeed(component, { active: false });
    (api as jest.Mock).mockRejectedValueOnce(new Error('首次恢复失败'));
    user.sessionVersion += 1;
    user.isLoggedIn = true;
    await wrapper.setProps({ active: true });
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('首次恢复失败');
    await wrapper.get('.error-feedback__action').trigger('click');
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.error-feedback').exists()).toBe(false);
  }
);

test('a hidden dining mutation invalidates retained results before they become visible again', async () => {
  const operation = deferred();
  (applyDiningInvite as jest.Mock).mockReturnValueOnce(operation.promise);
  const wrapper = mountFeed(DiningInvites);
  await flushPromises();
  await wrapper.get('.dining-join .dining-primary').trigger('click');
  await wrapper.setProps({ active: false });
  operation.resolve({ code: 200, data: invite() });
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(1);
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(2);
});

test.each([
  ['posts', PostFeed, getPosts, postsPage, '还没有校园动态', '正在加载动态'],
  ['dining', DiningInvites, getDiningInvites, diningPage, '暂时没有可加入的邀请', '正在加载邀请'],
] as const)(
  '%s shows loading during a refresh of a completed empty result',
  async (_name, component, api, response, emptyTitle, loadingTitle) => {
    const refresh = deferred();
    (api as jest.Mock).mockResolvedValueOnce(response([])).mockReturnValueOnce(refresh.promise);
    const wrapper = mountFeed(component);
    await flushPromises();
    expect(wrapper.text()).toContain(emptyTitle);
    const request = (wrapper.vm as any).refresh();
    await flushPromises();
    expect(wrapper.text()).toContain(loadingTitle);
    expect(wrapper.text()).not.toContain(emptyTitle);
    refresh.resolve(response([]));
    await request;
    await flushPromises();
    expect(wrapper.text()).toContain(emptyTitle);
  }
);

test('dining retains all loaded pages during section switches and advances from the retained page', async () => {
  (getDiningInvites as jest.Mock).mockImplementation(async (_mine, page) =>
    diningPage(['page-' + page], page, 3)
  );
  const wrapper = mountFeed(DiningInvites);
  await flushPromises();
  await (wrapper.vm as any).loadMore();
  await wrapper.setProps({ active: false });
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(2);
  expect(wrapper.findAll('.dining-invite')).toHaveLength(2);
  await (wrapper.vm as any).loadMore();
  await flushPromises();
  expect(getDiningInvites).toHaveBeenLastCalledWith(false, 3);
  expect(wrapper.findAll('.dining-invite')).toHaveLength(3);
});

test('dining eligibility keeps read access and disables participation until verification', async () => {
  user.userInfo.capabilities.canContribute = false;
  const wrapper = mountFeed(DiningInvites);
  await flushPromises();
  expect(wrapper.findAll('.dining-invite')).toHaveLength(1);
  expect(wrapper.get('.dining-join .dining-primary').attributes()).toHaveProperty('disabled');
  expect(wrapper.get('.dining-access').text()).toContain('认证后可参与约饭');
  await wrapper.get('.dining-access').trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/profile/identity' });
});

test('unmounting dining cancels a queued session reload before it sends a request', async () => {
  const wrapper = mountFeed(DiningInvites);
  await flushPromises();
  user.sessionVersion += 1;
  wrapper.unmount();
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(1);
});

test.each([
  ['posts', PostFeed, getPosts, postsPage],
  ['dining', DiningInvites, getDiningInvites, diningPage],
] as const)(
  '%s merges explicit refresh with a pending initial read',
  async (_name, component, api, response) => {
    const initial = deferred();
    (api as jest.Mock).mockReturnValueOnce(initial.promise);
    const wrapper = mountFeed(component);
    await (wrapper.vm as any).refresh();
    expect(api).toHaveBeenCalledTimes(1);
    initial.resolve(response([]));
    await flushPromises();
  }
);
