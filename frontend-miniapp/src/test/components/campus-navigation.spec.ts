import { shallowMount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { onShow, onHide, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import CampusPage from '@/pages/community/index.vue';
import DiningPage from '@/pages/planning/dining.vue';
import { getPosts } from '@/api/modules/social';
import { getNewsList } from '@/api/modules/news';
import PostFeed from '@/pages/community/components/PostFeed.vue';
import DiningInvites from '@/pages/planning/components/DiningInvites.vue';
import NewsFeed from '@/pages/news/components/NewsFeed.vue';
import FilterBar from '@/pages/index/components/FilterBar.vue';
import { getDiningInvites } from '@/api/modules/meal-plan';
import { useUserStore } from '@/store/modules/use-user-store';
import { openCampus, takeCampusSection } from '@/utils/campus-navigation';

jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onLoad: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onPageScroll: jest.fn(),
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
  const wrapper = shallowMount(component, {
    props,
    global: {
      stubs: {
        EmptyState: false,
        LoginGate: false,
        AsyncState: false,
        PostFeed: {
          template: '<view />',
          props: ['active'],
          methods: { refresh: jest.fn(), loadMore: jest.fn() },
        },
        DiningInvites: {
          template: '<view />',
          props: ['active'],
          methods: { refresh: jest.fn(), loadMore: jest.fn() },
        },
        NewsFeed: {
          template: '<view />',
          props: ['active'],
          methods: { refresh: jest.fn(), loadMore: jest.fn() },
        },
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  jest.clearAllMocks();
  (getPosts as jest.Mock).mockReset();
  (getNewsList as jest.Mock).mockReset();
  (getNewsList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
  });
  (getDiningInvites as jest.Mock).mockReset();
  uni.pageScrollTo = jest.fn();
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
  expect(wrapper.findComponent(PostFeed).exists()).toBe(true);
  expect(wrapper.findComponent(PostFeed).props('active')).toBe(false);
  expect(wrapper.findComponent(PostFeed).isVisible()).toBe(false);
  expect(wrapper.findComponent(DiningInvites).props('active')).toBe(true);
  (onHide as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(DiningInvites).props('active')).toBe(false);
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(DiningInvites).props('active')).toBe(true);
  await wrapper.findAll('[role="tab"]')[2].trigger('click');
  expect(wrapper.findComponent(NewsFeed).exists()).toBe(true);
  expect(wrapper.findComponent(NewsFeed).props('active')).toBe(true);
});

test('external planning and news links open the requested section on show', async () => {
  const wrapper = mountPage(CampusPage);
  openCampus('news');
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(NewsFeed).exists()).toBe(true);
  expect(wrapper.findComponent(NewsFeed).props('active')).toBe(true);
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
  expect(uni.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/login/index' })
  );
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

test('campus lazily retains each section instance and delegates page actions to the visible section', async () => {
  const actions = Object.fromEntries(
    ['PostFeed', 'DiningInvites', 'NewsFeed'].map(name => [
      name,
      {
        refresh: jest.fn().mockResolvedValue(undefined),
        loadMore: jest.fn(),
      },
    ])
  );
  const wrapper = shallowMount(CampusPage, {
    global: {
      stubs: Object.fromEntries(
        Object.entries(actions).map(([name, methods]) => [
          name,
          {
            template: '<view />',
            props: ['active'],
            methods,
          },
        ])
      ),
    },
  });
  wrappers.push(wrapper);
  expect(wrapper.findComponent(DiningInvites).exists()).toBe(false);
  expect(wrapper.findComponent(NewsFeed).exists()).toBe(false);
  const posts = wrapper.findComponent(PostFeed).vm;
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  const dining = wrapper.findComponent(DiningInvites).vm;
  await (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
  (onReachBottom as jest.Mock).mock.calls[0][0]();
  expect(actions.DiningInvites.refresh).toHaveBeenCalledTimes(1);
  expect(actions.DiningInvites.loadMore).toHaveBeenCalledTimes(1);
  expect(actions.PostFeed.refresh).not.toHaveBeenCalled();
  await wrapper.findAll('[role="tab"]')[2].trigger('click');
  await wrapper.findAll('[role="tab"]')[0].trigger('click');
  expect(wrapper.findComponent(PostFeed).vm).toBe(posts);
  expect(wrapper.findComponent(DiningInvites).vm).toBe(dining);
  expect(wrapper.findComponent(NewsFeed).props('active')).toBe(false);
});

test('switching campus sections restores each native page scroll position', async () => {
  const wrapper = mountPage(CampusPage);
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  (onPageScroll as jest.Mock).mock.calls[0][0]({ scrollTop: 320 });
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  expect(uni.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 0, duration: 0 });
  (onPageScroll as jest.Mock).mock.calls[0][0]({ scrollTop: 120 });
  await wrapper.findAll('[role="tab"]')[0].trigger('click');
  expect(uni.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 320, duration: 0 });
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  expect(uni.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 120, duration: 0 });
});

function mountRoute(component: typeof CampusPage | typeof DiningPage) {
  const wrapper = shallowMount(component, {
    global: {
      stubs: {
        PostFeed: false,
        NewsFeed: false,
        DiningInvites: false,
        LoginGate: false,
        AsyncState: false,
        EmptyState: false,
        PostCard: {
          props: ['post'],
          template: '<view class="test-post">{{ post.content }}</view>',
        },
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
const postPage = (content: string) => ({
  code: 200,
  data: {
    items: [{ id: content, content }],
    meta: { page: 1, totalPages: 1 },
  },
});
const invitationPage = (nickname: string) => ({
  code: 200,
  data: {
    items: [
      {
        id: nickname,
        host: { id: 'host', nickname },
        date: '2026-10-21',
        mealTime: 'lunch',
        startsAt: '2026-10-21T04:00:00Z',
        canteen: { name: '食堂' },
        capacity: 2,
        acceptedCount: 0,
        applications: [],
        status: 'open',
      },
    ],
    meta: { page: 1, totalPages: 1 },
  },
});

test('campus return refreshes retained posts while internal section switches reuse their lists', async () => {
  (getPosts as jest.Mock).mockResolvedValueOnce(postPage('原动态'));
  const wrapper = mountRoute(CampusPage);
  const show = (onShow as jest.Mock).mock.calls[0][0];
  const hide = (onHide as jest.Mock).mock.calls[0][0];
  show();
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(1);
  await wrapper.findAll('.campus-section')[1].trigger('click');
  await flushPromises();
  await wrapper.findAll('.campus-section')[0].trigger('click');
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(1);
  expect(getDiningInvites).toHaveBeenCalledTimes(1);
  hide();
  await flushPromises();
  let finish!: (value: unknown) => void;
  (getPosts as jest.Mock).mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  show();
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(2);
  expect(wrapper.get('.test-post').text()).toBe('原动态');
  expect(wrapper.text()).toContain('正在更新');
  finish(postPage('新动态'));
  await flushPromises();
  expect(wrapper.get('.test-post').text()).toBe('新动态');
  expect(getDiningInvites).toHaveBeenCalledTimes(1);
});

test.each([
  ['campus', CampusPage],
  ['standalone', DiningPage],
] as const)(
  '%s dining return refreshes retained invitations without a duplicate first read',
  async (route, component) => {
    (getDiningInvites as jest.Mock).mockResolvedValueOnce(invitationPage('原邀请'));
    const wrapper = mountRoute(component);
    if (route === 'campus') openCampus('dining');
    const show = (onShow as jest.Mock).mock.calls[0][0];
    const hide = (onHide as jest.Mock).mock.calls[0][0];
    show();
    await flushPromises();
    expect(getDiningInvites).toHaveBeenCalledTimes(1);
    hide();
    await flushPromises();
    let finish!: (value: unknown) => void;
    (getDiningInvites as jest.Mock).mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    show();
    await flushPromises();
    expect(getDiningInvites).toHaveBeenCalledTimes(2);
    expect(wrapper.get('.dining-host').text()).toBe('原邀请');
    finish(invitationPage('新邀请'));
    await flushPromises();
    expect(wrapper.get('.dining-host').text()).toBe('新邀请');
  }
);

describe.each([
  ['campus posts', CampusPage, 'posts', getPosts, postPage, '.test-post'],
  ['campus dining', CampusPage, 'dining', getDiningInvites, invitationPage, '.dining-host'],
  ['standalone dining', DiningPage, 'dining', getDiningInvites, invitationPage, '.dining-host'],
] as const)('%s session recovery', (_name, component, section, api, response, contentSelector) => {
  test.each(['pending', 'success', 'failure'] as const)(
    'return performs one initial attempt when the response is %s',
    async outcome => {
      (api as jest.Mock).mockResolvedValueOnce(response('原账号内容'));
      const wrapper = mountRoute(component);
      if (component === CampusPage) openCampus(section);
      const show = (onShow as jest.Mock).mock.calls[0][0];
      show();
      await flushPromises();
      expect(api).toHaveBeenCalledTimes(1);
      (onHide as jest.Mock).mock.calls[0][0]();
      await flushPromises();
      user.sessionVersion += 1;
      await flushPromises();
      let finish!: (value: unknown) => void;
      if (outcome === 'success') (api as jest.Mock).mockResolvedValueOnce(response('当前账号内容'));
      else if (outcome === 'failure')
        (api as jest.Mock).mockRejectedValueOnce(new Error('当前账号加载失败'));
      else
        (api as jest.Mock).mockReturnValueOnce(
          new Promise(resolve => {
            finish = resolve;
          })
        );
      show();
      await flushPromises();
      expect(api).toHaveBeenCalledTimes(2);
      if (outcome === 'failure') {
        expect(wrapper.text()).toContain('当前账号加载失败');
        expect(wrapper.find(contentSelector).exists()).toBe(false);
      } else {
        if (outcome === 'pending') {
          expect(wrapper.find(contentSelector).exists()).toBe(false);
          finish(response('当前账号内容'));
        }
        await flushPromises();
        expect(wrapper.get(contentSelector).text()).toBe('当前账号内容');
      }
    }
  );
});

test.each([
  ['posts', getPosts, postPage],
  ['dining', getDiningInvites, invitationPage],
  [
    'news',
    getNewsList,
    () => ({ code: 200, data: { items: [], meta: { page: 1, totalPages: 0 } } }),
  ],
] as const)(
  '%s initial failure gets one fresh attempt on route return',
  async (section, api, response) => {
    (api as jest.Mock)
      .mockRejectedValueOnce(new Error('初读失败'))
      .mockResolvedValueOnce(response('恢复内容'));
    const wrapper = mountRoute(CampusPage);
    openCampus(section);
    const show = (onShow as jest.Mock).mock.calls[0][0];
    show();
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.error-feedback').exists()).toBe(true);
    (onHide as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(1);
    show();
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.error-feedback').exists()).toBe(false);
  }
);

test('returning to an in-flight news initial read keeps one request', async () => {
  let finish!: (value: unknown) => void;
  (getNewsList as jest.Mock).mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  const wrapper = mountRoute(CampusPage);
  openCampus('news');
  const show = (onShow as jest.Mock).mock.calls[0][0];
  show();
  await flushPromises();
  expect(getNewsList).toHaveBeenCalledTimes(1);
  (onHide as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  show();
  await flushPromises();
  expect(getNewsList).toHaveBeenCalledTimes(1);
  finish({ code: 200, data: { items: [], meta: { page: 1, totalPages: 0 } } });
  await flushPromises();
  expect(wrapper.text()).toContain('暂无新闻');
});

test.each([
  ['posts', 0, getPosts, postPage, '.test-post'],
  ['dining', 1, getDiningInvites, invitationPage, '.dining-host'],
] as const)(
  'previously visited %s refreshes on its first activation after a route return',
  async (section, tab, api, response, contentSelector) => {
    (api as jest.Mock).mockResolvedValue(response('原内容'));
    const wrapper = mountRoute(CampusPage);
    const show = (onShow as jest.Mock).mock.calls[0][0];
    const hide = (onHide as jest.Mock).mock.calls[0][0];
    openCampus(section);
    show();
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(1);
    (onPageScroll as jest.Mock).mock.calls[0][0]({ scrollTop: 320 });
    await wrapper.findAll('.campus-section')[2].trigger('click');
    await flushPromises();
    expect(getNewsList).toHaveBeenCalledTimes(1);
    hide();
    await flushPromises();
    (api as jest.Mock).mockResolvedValue(response('更新内容'));
    expect(api).toHaveBeenCalledTimes(1);
    expect(getNewsList).toHaveBeenCalledTimes(1);
    show();
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(1);
    expect(getNewsList).toHaveBeenCalledTimes(2);
    await wrapper.findAll('.campus-section')[tab].trigger('click');
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(2);
    expect(wrapper.get(contentSelector).text()).toBe('更新内容');
    expect(uni.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 320, duration: 0 });
    await wrapper.findAll('.campus-section')[2].trigger('click');
    await wrapper.findAll('.campus-section')[tab].trigger('click');
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(2);
    expect(getNewsList).toHaveBeenCalledTimes(2);
  }
);

test('leaving a dirty section during its refresh keeps it due for refresh on the next activation', async () => {
  (getPosts as jest.Mock).mockResolvedValueOnce(postPage('原动态'));
  const wrapper = mountRoute(CampusPage);
  const show = (onShow as jest.Mock).mock.calls[0][0];
  show();
  await flushPromises();
  await wrapper.findAll('.campus-section')[2].trigger('click');
  await flushPromises();
  (onHide as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  show();
  await flushPromises();
  let finish!: (value: unknown) => void;
  (getPosts as jest.Mock)
    .mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    )
    .mockResolvedValueOnce(postPage('当前动态'));
  await wrapper.findAll('.campus-section')[0].trigger('click');
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(2);
  await wrapper.findAll('.campus-section')[2].trigger('click');
  await wrapper.findAll('.campus-section')[0].trigger('click');
  await flushPromises();
  expect(getPosts).toHaveBeenCalledTimes(3);
  finish(postPage('旧刷新结果'));
  await flushPromises();
  expect(wrapper.get('.test-post').text()).toBe('当前动态');
});
