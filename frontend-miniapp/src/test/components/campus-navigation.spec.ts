import { shallowMount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import CampusPage from '@/pages/community/index.vue';
import PostFeed from '@/pages/community/components/PostFeed.vue';
import DiningInvites from '@/pages/planning/components/DiningInvites.vue';
import NewsFeed from '@/pages/news/components/NewsFeed.vue';
import FilterBar from '@/pages/index/components/FilterBar.vue';
import { getDiningInvites } from '@/api/modules/meal-plan';
import { useUserStore } from '@/store/modules/use-user-store';
import { openCampus, takeCampusSection } from '@/utils/campus-navigation';

jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onBackPress: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/api/modules/meal-plan', () => ({
  getDiningInvites: jest.fn(),
  getDiningInvite: jest.fn(),
  applyDiningInvite: jest.fn(),
  decideDiningApplication: jest.fn(),
  withdrawDiningApplication: jest.fn(),
  cancelDiningInvite: jest.fn(),
}));
jest.mock('@/api/modules/social', () => ({ getPosts: jest.fn() }));
jest.mock('@/api/modules/news', () => ({ getNewsList: jest.fn() }));
let user: { sessionVersion: number; isLoggedIn: boolean; userInfo: { id: string } };
const wrappers: ReturnType<typeof shallowMount>[] = [];
function mountPage(component: Parameters<typeof shallowMount>[0], props = {}) {
  const wrapper = shallowMount(component, { props, global: { stubs: { EmptyState: false } } });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  jest.clearAllMocks();
  takeCampusSection();
  user = reactive({ sessionVersion: 1, isLoggedIn: true, userInfo: { id: 'campus-test' } });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (getDiningInvites as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { page: 1, totalPages: 0 } },
  });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

test('tab navigation carries a section once without unsupported switchTab query parameters', () => {
  openCampus('dining');
  expect(uni.switchTab).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/community/index' })
  );
  expect(takeCampusSection()).toBe('dining');
  expect(takeCampusSection()).toBeUndefined();
});

test('a failed navigation does not leave a stale destination', () => {
  openCampus('news');
  (uni.switchTab as jest.Mock).mock.calls[0][0].fail();
  expect(takeCampusSection()).toBeUndefined();
});

test('one campus page hosts exactly three content sections and preserves the selected section on return', async () => {
  const wrapper = mountPage(CampusPage);
  expect(wrapper.findAll('[role="tab"]').map(button => button.text())).toEqual([
    '动态',
    '约饭',
    '资讯',
  ]);
  expect(wrapper.findComponent(PostFeed).exists()).toBe(true);
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(PostFeed).props('active')).toBe(true);
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  expect(wrapper.findComponent(PostFeed).exists()).toBe(false);
  expect(wrapper.findComponent(DiningInvites).props('active')).toBe(true);
  (onHide as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(DiningInvites).props('active')).toBe(false);
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(DiningInvites).props('active')).toBe(true);
  await wrapper.findAll('[role="tab"]')[2].trigger('click');
  expect(wrapper.findComponent(NewsFeed).exists()).toBe(true);
});

test('external planning and news links open the requested section on show', async () => {
  const wrapper = mountPage(CampusPage);
  openCampus('news');
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(NewsFeed).exists()).toBe(true);
});

test('pull-to-refresh delegates to the selected section and ends the page refresh', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  const wrapper = shallowMount(CampusPage, {
    global: {
      stubs: {
        PostFeed: { template: '<view />', methods: { refresh } },
      },
    },
  });
  wrappers.push(wrapper);
  await (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(uni.stopPullDownRefresh).toHaveBeenCalled();
});

test('guest dining section offers login without firing an unauthorized request or redirect', async () => {
  user.isLoggedIn = false;
  const wrapper = mountPage(DiningInvites);
  await flushPromises();
  expect(getDiningInvites).not.toHaveBeenCalled();
  expect(uni.navigateTo).not.toHaveBeenCalled();
  expect(wrapper.text()).toContain('登录后查看约饭邀请');
  await wrapper.get('.empty-state__action').trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/login/index' });
});

test('dining append retry keeps all loaded pages and refresh failure preserves the recovered list', async () => {
  const invite = (page: number) => ({
    id: 'invite-' + page,
    host: { id: 'campus-test', nickname: '同学' + page },
    date: '2026-10-20',
    mealTime: 'lunch',
    startsAt: '2026-10-20T04:00:00Z',
    canteen: { name: '食堂' },
    capacity: 2,
    acceptedCount: 0,
    applications: [],
    status: 'open',
  });
  let failedPage = 3;
  (getDiningInvites as jest.Mock).mockImplementation(async (_mine, page) => {
    if (page === failedPage) throw new Error('网络中断');
    return { code: 200, data: { items: [invite(page)], meta: { page, totalPages: 3 } } };
  });
  const wrapper = mountPage(DiningInvites);
  await flushPromises();
  await (wrapper.vm as any).loadMore();
  await flushPromises();
  await (wrapper.vm as any).loadMore();
  await flushPromises();
  expect(wrapper.findAll('.dining-invite')).toHaveLength(2);
  expect(wrapper.find('.dining-more').exists()).toBe(false);
  failedPage = 0;
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(getDiningInvites).toHaveBeenLastCalledWith(false, 3);
  expect(wrapper.findAll('.dining-invite')).toHaveLength(3);
  failedPage = 1;
  await (wrapper.vm as any).refresh();
  await flushPromises();
  expect(wrapper.findAll('.dining-invite')).toHaveLength(3);
  expect(wrapper.find('.dining-more').exists()).toBe(false);
  failedPage = 0;
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(getDiningInvites).toHaveBeenLastCalledWith(false, 1);
  expect(wrapper.find('.error-feedback').exists()).toBe(false);
});

test('inactive dining panels wait until visible to fetch and ignore hidden in-flight results', async () => {
  let resolve!: (value: unknown) => void;
  (getDiningInvites as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const wrapper = shallowMount(DiningInvites, { props: { active: false } });
  wrappers.push(wrapper);
  expect(getDiningInvites).not.toHaveBeenCalled();
  await wrapper.setProps({ active: true });
  expect(getDiningInvites).toHaveBeenCalledTimes(1);
  await wrapper.setProps({ active: false });
  resolve({ code: 200, data: { items: [], meta: { page: 1, totalPages: 0 } } });
  await flushPromises();
  expect(wrapper.text()).not.toContain('暂时没有可加入的邀请');
});

test('logging in on a mounted dining section fetches the new account view', async () => {
  user.isLoggedIn = false;
  const wrapper = mountPage(DiningInvites);
  user.sessionVersion += 1;
  await flushPromises();
  expect(getDiningInvites).not.toHaveBeenCalled();
  user.isLoggedIn = true;
  await flushPromises();
  expect(getDiningInvites).toHaveBeenCalledTimes(1);
  expect(wrapper.text()).toContain('暂时没有可加入的邀请');
});

test('horizontal filter controls keep scrolling without the native scrollbar', () => {
  const wrapper = mountPage(FilterBar, { filter: {} });
  const strip = wrapper.get('.filters__entrances');
  expect(strip.attributes('show-scrollbar')).toBe('false');
  expect(strip.attributes()).toHaveProperty('scroll-x');
});
