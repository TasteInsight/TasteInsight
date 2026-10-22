import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/modules/use-user-store';
import { getMyReviews, getMyFavorites, getBrowseHistory } from '@/api/modules/user';
import { getNewsList, getNewsById } from '@/api/modules/news';
import ReviewsPage from '@/pages/profile/records/my-reviews/index.vue';
import FavoritesPage from '@/pages/profile/records/my-favorites/index.vue';
import HistoryPage from '@/pages/profile/records/history/index.vue';
import NewsPage from '@/pages/news/components/NewsFeed.vue';
import NewsDetailPage from '@/pages/news/components/detail.vue';
import ReviewCard from '@/pages/profile/components/ReviewCard.vue';
import DishCard from '@/pages/profile/components/ProfileDishCard.vue';
import NewsItem from '@/pages/news/components/NewsItem.vue';
import EmptyState from '@/components/EmptyState.vue';

jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/api/modules/user', () => ({
  getMyReviews: jest.fn(),
  getMyFavorites: jest.fn(),
  getBrowseHistory: jest.fn(),
}));
jest.mock('@/api/modules/dish', () => ({ unfavoriteDish: jest.fn() }));
jest.mock('@/api/modules/news', () => ({ getNewsList: jest.fn(), getNewsById: jest.fn() }));

function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<any>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const response = (items: any[], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items, meta: { page, pageSize: 10, totalPages, total: items.length } },
});
const item = (id: string) => ({
  id,
  dishId: id,
  dishName: id,
  title: id,
  rating: 4,
  content: `${id}内容`,
});
const article = (id: string) => ({
  code: 200,
  data: { id, title: `${id}公告`, content: `<p>${id}正文</p>` },
});
const personalCases = [
  {
    name: 'reviews',
    Page: ReviewsPage,
    api: getMyReviews,
    empty: '暂无评价',
    icon: 'star',
    Card: ReviewCard,
  },
  {
    name: 'favorites',
    Page: FavoritesPage,
    api: getMyFavorites,
    empty: '暂无收藏',
    icon: 'bookmark',
    Card: DishCard,
  },
  {
    name: 'history',
    Page: HistoryPage,
    api: getBrowseHistory,
    empty: '暂无浏览历史',
    icon: 'history',
    Card: DishCard,
  },
] as const;
const listCases = [
  ...personalCases,
  {
    name: 'news',
    Page: NewsPage,
    api: getNewsList,
    empty: '暂无新闻',
    icon: 'info',
    Card: NewsItem,
  },
] as const;
const wrappers: VueWrapper[] = [];
let store: any;
let consoleError: jest.SpyInstance;

function mountPage(Page: any) {
  const wrapper = shallowMount(Page, {
    global: { stubs: { EmptyState: false, UiIcon: false, AsyncState: false, LoginGate: false } },
  });
  wrappers.push(wrapper);
  return wrapper;
}

function startList(name: string) {
  if (name !== 'news') (onShow as jest.Mock).mock.calls[0][0]();
}

function loadDetail(id: string) {
  (onLoad as jest.Mock).mock.calls[0][0]({ id });
}

function expectPendingContent(wrapper: VueWrapper) {
  expect(wrapper.find('.page-content, .news-page').exists()).toBe(true);
  expect(wrapper.html()).not.toMatch(/skeleton/i);
  expect(
    wrapper.find('.dish-list-state, .dish-list-footer, .news-state, .article-state').exists()
  ).toBe(false);
  expect(wrapper.findAllComponents(EmptyState).every(state => state.props('loading'))).toBe(true);
  expect(wrapper.find('button').exists()).toBe(false);
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const api of [getMyReviews, getMyFavorites, getBrowseHistory, getNewsList, getNewsById]) {
    (api as jest.Mock).mockReset();
  }
  store = reactive({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'a' } });
  (useUserStore as unknown as jest.Mock).mockReturnValue(store);
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  consoleError.mockRestore();
});

describe.each(listCases)('$name loading lifecycle', ({ name, Page, api, empty, icon, Card }) => {
  it('keeps initial data undisclosed while loading and renders returned items immediately', async () => {
    const first = deferred();
    (api as jest.Mock).mockReturnValueOnce(first.promise);
    const wrapper = mountPage(Page);
    expectPendingContent(wrapper);
    startList(name);
    await nextTick();
    expectPendingContent(wrapper);
    expect((wrapper.vm as any).initialized).toBe(false);

    first.resolve(response([item('first')]));
    await flushPromises();
    expect(wrapper.findComponent(Card).exists()).toBe(true);
    expect((wrapper.vm as any).initialized).toBe(true);
    expect(wrapper.text()).not.toContain(empty);
    expect(wrapper.html()).not.toMatch(/skeleton/i);
  });

  it('shows an empty state only after success and replaces it with loading during refresh', async () => {
    const first = deferred();
    const refresh = deferred();
    (api as jest.Mock).mockReturnValueOnce(first.promise).mockReturnValueOnce(refresh.promise);
    const wrapper = mountPage(Page);
    startList(name);
    await nextTick();
    expectPendingContent(wrapper);
    first.resolve(response([]));
    await flushPromises();
    expect(wrapper.text()).toContain(empty);
    const emptyState = wrapper.getComponent(EmptyState);
    expect(emptyState.props('icon')).toBe(icon);
    expect(emptyState.text()).toBe(empty);
    expect(emptyState.get('.ui-icon').attributes('src')).toBe(`/static/icons/ui/${icon}-muted.png`);
    expect((wrapper.vm as any).initialized).toBe(true);

    const refreshing = (wrapper.vm as any).refresh();
    await nextTick();
    expect(wrapper.text()).not.toContain(empty);
    expect(wrapper.getComponent(EmptyState).props('loading')).toBe(true);
    expect(wrapper.html()).not.toMatch(/skeleton/i);
    refresh.resolve(response([item('fresh')]));
    await refreshing;
    await flushPromises();
    expect(wrapper.findComponent(Card).exists()).toBe(true);
    expect(wrapper.text()).not.toContain(empty);
  });

  it.each(['timeout', 'non-200'])(
    'shows retry after a first %s failure without disclosing an empty result',
    async failure => {
      const first = deferred();
      const retry = deferred();
      (api as jest.Mock).mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
      const wrapper = mountPage(Page);
      startList(name);
      if (failure === 'timeout') first.reject(new Error('请求超时，请重试'));
      else first.resolve({ code: 500, message: '读取失败' });
      await flushPromises();
      expect(wrapper.text()).not.toContain(empty);
      expect(wrapper.find('[role="alert"], [role="status"]').exists()).toBe(true);
      expect(wrapper.find('button').exists()).toBe(true);
      expect((wrapper.vm as any).initialized).toBe(false);
      expect(wrapper.html()).not.toMatch(/skeleton/i);

      await wrapper.find('button').trigger('click');
      expectPendingContent(wrapper);
      expect(api).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
      retry.resolve(response([]));
      await flushPromises();
      expect(wrapper.text()).toContain(empty);
      expect((wrapper.vm as any).initialized).toBe(true);
    }
  );

  it('retains cards during refresh and append failures and retries the same request', async () => {
    (api as jest.Mock).mockResolvedValueOnce(response([item('first')], 1, 3));
    const wrapper = mountPage(Page);
    startList(name);
    await flushPromises();
    const refresh = deferred();
    (api as jest.Mock).mockReturnValueOnce(refresh.promise);
    const refreshing = (wrapper.vm as any).refresh();
    await nextTick();
    expect(wrapper.findComponent(Card).exists()).toBe(true);
    expect((wrapper.vm as any).initialized).toBe(true);
    expect(wrapper.html()).not.toMatch(/skeleton/i);
    refresh.reject(new Error('刷新失败'));
    await refreshing;
    await flushPromises();
    expect(wrapper.findComponent(Card).exists()).toBe(true);
    expect(wrapper.find('button').exists()).toBe(true);
    (api as jest.Mock).mockResolvedValueOnce(response([item('fresh')], 1, 3));
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(api).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });

    const append = deferred();
    (api as jest.Mock).mockReturnValueOnce(append.promise);
    (wrapper.vm as any).loadMore();
    await nextTick();
    expect(wrapper.findAllComponents(Card)).toHaveLength(1);
    append.reject(new Error('追加失败'));
    await flushPromises();
    expect(wrapper.findAllComponents(Card)).toHaveLength(1);
    expect((wrapper.vm as any).initialized).toBe(true);
    (api as jest.Mock).mockResolvedValueOnce(response([item('next')], 2, 3));
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(api).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 });
    expect(wrapper.findAllComponents(Card)).toHaveLength(2);
  });
});

it.each(personalCases)(
  '$name resets successful readiness on account switch and ignores the previous account read',
  async ({ name, Page, api, empty }) => {
    (api as jest.Mock).mockResolvedValueOnce(response([]));
    const wrapper = mountPage(Page);
    startList(name);
    await flushPromises();
    expect(wrapper.text()).toContain(empty);
    const old = deferred();
    const current = deferred();
    (api as jest.Mock).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldRefresh = (wrapper.vm as any).refresh();
    store.sessionVersion++;
    store.userInfo = { id: 'b' };
    await nextTick();
    expectPendingContent(wrapper);
    expect((wrapper.vm as any).initialized).toBe(false);
    const currentRefresh = (wrapper.vm as any).refresh();
    old.resolve(response([item('old-account')]));
    await oldRefresh;
    await nextTick();
    expectPendingContent(wrapper);
    expect((wrapper.vm as any).loading).toBe(true);
    expect((wrapper.vm as any).initialized).toBe(false);
    current.resolve(response([]));
    await currentRefresh;
    await nextTick();
    expect(wrapper.text()).toContain(empty);
    expect((wrapper.vm as any).initialized).toBe(true);
  }
);

describe('news detail loading lifecycle', () => {
  it('passes an imported article to the rich renderer and offers its original link', async () => {
    const content = '<section style="padding:12px"><p>公众号正文</p></section>';
    (getNewsById as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        id: 'imported',
        title: '公众号公告',
        content,
        sourceName: '食在清华',
        sourceUrl: 'https://mp.weixin.qq.com/s/imported',
      },
    });
    const wrapper = mountPage(NewsDetailPage);
    loadDetail('imported');
    await flushPromises();
    const renderer = wrapper.findComponent({ name: 'MpHtml' });
    expect(renderer.props()).toMatchObject({ content, previewImg: true, scrollTable: true });
    expect(wrapper.find('.article-source').text()).toContain('食在清华');
    expect(wrapper.find('.original-link').text()).toBe('查看微信原文');
  });

  it('keeps initial data undisclosed while loading before and during its route read', async () => {
    const first = deferred();
    (getNewsById as jest.Mock).mockReturnValueOnce(first.promise);
    const wrapper = mountPage(NewsDetailPage);
    expectPendingContent(wrapper);
    expect(getNewsById).not.toHaveBeenCalled();
    loadDetail('first');
    await nextTick();
    expectPendingContent(wrapper);
    first.resolve(article('first'));
    await flushPromises();
    expect(wrapper.find('.article-title').text()).toBe('first公告');
    expect((wrapper.vm as any).initialized).toBe(true);
    expect(wrapper.html()).not.toMatch(/skeleton/i);
  });

  it.each(['timeout', 'non-200'])(
    'exposes a retry after a first %s failure and keeps retry pending blank',
    async failure => {
      const first = deferred();
      const retry = deferred();
      (getNewsById as jest.Mock)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(retry.promise);
      const wrapper = mountPage(NewsDetailPage);
      loadDetail('first');
      if (failure === 'timeout') first.reject(new Error('请求超时，请重试'));
      else first.resolve({ code: 500, message: '读取失败' });
      await flushPromises();
      expect(wrapper.text()).toContain('新闻加载失败，请重试');
      expect(wrapper.find('button').text()).toBe('重新加载');
      expect((wrapper.vm as any).initialized).toBe(false);
      await wrapper.find('button').trigger('click');
      expectPendingContent(wrapper);
      retry.resolve(article('first'));
      await flushPromises();
      expect(wrapper.find('.article-title').text()).toBe('first公告');
      expect((wrapper.vm as any).initialized).toBe(true);
    }
  );

  it.each(['timeout', 'not-found'])(
    'retains its successful article during same-resource refresh and after %s failure',
    async failure => {
      (getNewsById as jest.Mock).mockResolvedValueOnce(article('first'));
      const wrapper = mountPage(NewsDetailPage);
      loadDetail('first');
      await flushPromises();
      const refresh = deferred();
      (getNewsById as jest.Mock).mockReturnValueOnce(refresh.promise);
      const refreshing = (wrapper.vm as any).retry();
      await nextTick();
      expect(wrapper.find('.article-title').text()).toBe('first公告');
      expect(wrapper.html()).not.toMatch(/skeleton/i);
      if (failure === 'timeout') refresh.reject(new Error('请求超时，请重试'));
      else refresh.resolve({ code: 404, message: 'missing' });
      await refreshing;
      await nextTick();
      expect(wrapper.find('.article-title').text()).toBe('first公告');
      expect(wrapper.find('.async-state.error-feedback').exists()).toBe(true);
      expect((wrapper.vm as any).initialized).toBe(true);
      expect(wrapper.find('button').text()).toBe(
        failure === 'timeout' ? '重新加载' : '返回新闻列表'
      );
    }
  );

  it('clears the previous article on resource switch and rejects its superseded refresh', async () => {
    (getNewsById as jest.Mock).mockResolvedValueOnce(article('first'));
    const wrapper = mountPage(NewsDetailPage);
    loadDetail('first');
    await flushPromises();
    const old = deferred();
    const current = deferred();
    (getNewsById as jest.Mock)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const oldRefresh = (wrapper.vm as any).retry();
    loadDetail('current');
    await nextTick();
    expectPendingContent(wrapper);
    expect(wrapper.find('.article-title').exists()).toBe(false);
    expect((wrapper.vm as any).initialized).toBe(false);
    old.resolve(article('old'));
    await oldRefresh;
    await nextTick();
    expectPendingContent(wrapper);
    expect((wrapper.vm as any).loading).toBe(true);
    current.resolve(article('current'));
    await flushPromises();
    expect(wrapper.find('.article-title').text()).toBe('current公告');
    expect((wrapper.vm as any).initialized).toBe(true);
  });

  it('ends pending ownership when a route loses its article id and offers a return action', async () => {
    const first = deferred();
    (getNewsById as jest.Mock).mockReturnValueOnce(first.promise);
    const wrapper = mountPage(NewsDetailPage);
    loadDetail('first');
    loadDetail('');
    await nextTick();
    expect((wrapper.vm as any).loading).toBe(false);
    expect((wrapper.vm as any).initialized).toBe(false);
    expect(wrapper.text()).toContain('新闻不存在或已下架');
    expect(wrapper.find('button').text()).toBe('返回新闻列表');
    first.resolve(article('first'));
    await flushPromises();
    expect(wrapper.find('.article-title').exists()).toBe(false);
    expect(wrapper.text()).toContain('新闻不存在或已下架');
    expect(getNewsById).toHaveBeenCalledTimes(1);
  });
});
