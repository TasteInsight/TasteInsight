import { effectScope, reactive, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import HomePage from '@/pages/index/index.vue';
import CanteenPage from '@/pages/canteen/index.vue';
import WindowPage from '@/pages/window/index.vue';
import TagPage from '@/pages/dish/components/TagList.vue';
import DishPage from '@/pages/dish/index.vue';
import SearchPage from '@/pages/search/index.vue';
import AllCommentsPanel from '@/pages/dish/components/AllCommentsPanel.vue';
import ReviewList from '@/pages/dish/components/ReviewList.vue';
import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';
import { useSearch } from '@/pages/search/composables/use-search';
import { useReview } from '@/pages/dish/composables/use-review';
import { useCommentPanel } from '@/pages/dish/composables/use-comment';
import { getRecommendations } from '@/api/modules/recommendation';
import { getDishes, getDishesByIds, getDishById } from '@/api/modules/dish';
import { getCanteenDetail, getCanteenList, getWindowDetail, getWindowList } from '@/api/modules/canteen';
import { getOwnReviewByDish, getReviewsByDish } from '@/api/modules/review';
import { getCommentsByReview } from '@/api/modules/comment';

const mockUser = reactive({
  sessionVersion: 1,
  isLoggedIn: true,
  userInfo: { id: 'user', settings: { displaySettings: { sortBy: 'rating' } } },
  fetchProfileAction: jest.fn(),
});
const mockCanteens = reactive({
  canteenList: [] as any[],
  pagination: null as any,
  loading: false,
  loadingMore: false,
  error: null as string | null,
  fetchCanteenList: jest.fn(),
  loadMoreCanteenList: jest.fn(),
});
const mockDishes = reactive({
  dishes: [] as any[],
  pagination: null as any,
  loading: false,
  loadingMore: false,
  error: null as string | null,
});
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onHide: jest.fn(),
  onBackPress: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@/store/modules/use-canteen-store', () => ({ useCanteenStore: () => mockCanteens }));
jest.mock('@/store/modules/use-dishes-store', () => ({ useDishesStore: () => mockDishes }));
jest.mock('@/store/modules/use-plan-store', () => ({ usePlanStore: () => ({ createPlan: jest.fn() }) }));
jest.mock('@/api/modules/recommendation', () => ({
  RecommendationScene: { HOME: 'home' },
  getRecommendations: jest.fn(),
}));
jest.mock('@/api/modules/dish', () => ({
  getDishes: jest.fn(),
  getDishesByIds: jest.fn(),
  getDishById: jest.fn(),
  favoriteDish: jest.fn(),
  unfavoriteDish: jest.fn(),
}));
jest.mock('@/api/modules/canteen', () => ({
  getCanteenDetail: jest.fn(),
  getCanteenList: jest.fn(),
  getWindowDetail: jest.fn(),
  getWindowList: jest.fn(),
}));
jest.mock('@/api/modules/review', () => ({
  getOwnReviewByDish: jest.fn(),
  getReviewsByDish: jest.fn(),
  createReview: jest.fn(),
  deleteReview: jest.fn(),
  reportReview: jest.fn(),
}));
jest.mock('@/api/modules/comment', () => ({
  getCommentsByReview: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
  reportComment: jest.fn(),
}));
jest.mock('@/api/modules/upload', () => ({ uploadImage: jest.fn() }));

const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise<any>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const itemsResponse = (items: any[] = [], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items, meta: { page, pageSize: 20, totalPages, total: items.length } },
});
const recommendationResponse = (items: any[] = []) => ({
  ...itemsResponse(items),
  data: { ...itemsResponse(items).data, requestId: 'recommendation' },
});
const dish = (id = 'dish') => ({
  id, name: `菜品 ${id}`, price: 8, images: [], tags: [], reviewCount: 0,
});
const wrappers: ReturnType<typeof mount>[] = [];
const scopes: ReturnType<typeof effectScope>[] = [];
const scoped = <T>(setup: () => T): T => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(setup)!;
};
const mountPage = (component: any, props?: any) => {
  const wrapper = mount(component, {
    props,
    global: {
      stubs: {
        SearchBar: true,
        FilterBar: true,
        CanteenFilterBar: true,
        RecommendItem: { props: ['dish'], template: '<div class="result-dish">{{ dish.name }}</div>' },
        CanteenDishCard: { props: ['dish'], template: '<div class="result-dish">{{ dish.name }}</div>' },
        DishResultItem: { props: ['dish'], template: '<div class="result-dish">{{ dish.name }}</div>' },
        RatingBars: true,
        ReviewForm: true,
        BottomReviewInput: true,
        PlanEditDialog: true,
        AllCommentsPanel: component !== AllCommentsPanel,
        CommentList: true,
        LongPressMenu: true,
        ReportDialog: true,
        'swiper': true,
        'swiper-item': true,
        'page-container': true,
        'uni-icons': true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
};
const loadRoute = (options: any) => (onLoad as jest.Mock).mock.calls.at(-1)![0](options);
const expectUndisclosed = (wrapper: ReturnType<typeof mount>) => {
  expect(wrapper.html()).not.toMatch(/skeleton/i);
  expect(wrapper.text()).not.toMatch(/暂无|没有符合|没有推荐|想吃点什么|未找到|还没有回复|加载中|正在加载/);
};

beforeEach(() => {
  jest.clearAllMocks();
  [getDishes, getDishesByIds, getDishById, getRecommendations, getCanteenDetail, getWindowDetail,
    getWindowList, getCanteenList, getReviewsByDish, getOwnReviewByDish, getCommentsByReview]
    .forEach(mock => (mock as jest.Mock).mockReset());
  mockUser.sessionVersion++;
  mockUser.userInfo.settings.displaySettings.sortBy = 'rating';
  mockUser.fetchProfileAction.mockResolvedValue(undefined);
  mockCanteens.canteenList = [];
  mockCanteens.pagination = null;
  mockCanteens.loading = false;
  mockCanteens.error = null;
  mockCanteens.fetchCanteenList.mockResolvedValue(undefined);
  mockDishes.dishes = [];
  mockDishes.pagination = null;
  mockDishes.loading = false;
  mockDishes.loadingMore = false;
  (getRecommendations as jest.Mock).mockResolvedValue(recommendationResponse());
  (getDishes as jest.Mock).mockResolvedValue(itemsResponse());
  (getDishesByIds as jest.Mock).mockResolvedValue(itemsResponse([dish()]));
  (getCanteenList as jest.Mock).mockResolvedValue(itemsResponse());
  (getCanteenDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'canteen', name: '食堂' } });
  (getWindowList as jest.Mock).mockResolvedValue(itemsResponse());
  (getWindowDetail as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'window', name: '窗口' } });
  (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: dish() });
  (getReviewsByDish as jest.Mock).mockResolvedValue(itemsResponse());
  (getOwnReviewByDish as jest.Mock).mockResolvedValue({ code: 200, data: null });
  (getCommentsByReview as jest.Mock).mockResolvedValue(itemsResponse());
  (uni as any).setNavigationBarTitle = jest.fn();
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  scopes.splice(0).forEach(scope => scope.stop());
});

describe('discovery initial loading', () => {
  test('home keeps search and filtering mounted until recommendations resolve', async () => {
    const pending = deferred();
    (getRecommendations as jest.Mock).mockReturnValueOnce(pending.promise);
    const wrapper = mountPage(HomePage);
    await flushPromises();
    expect(wrapper.find('search-bar-stub').exists()).toBe(true);
    expect(wrapper.find('filter-bar-stub').exists()).toBe(true);
    expectUndisclosed(wrapper);
    pending.resolve(recommendationResponse([{ id: 'dish' }]));
    await flushPromises();
    expect(wrapper.text()).toContain('菜品 dish');
  });

  test('home shows an empty result only after success and never after failure', async () => {
    const pending = deferred();
    (getRecommendations as jest.Mock).mockReturnValueOnce(pending.promise);
    const wrapper = mountPage(HomePage);
    await flushPromises();
    expectUndisclosed(wrapper);
    pending.reject(new Error('offline'));
    await flushPromises();
    expect(wrapper.text()).toContain('加载首页数据失败');
    expect(wrapper.text()).not.toContain('没有推荐');
    await wrapper.get('.home-text-button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('没有推荐菜品');
  });

  test('home retains cached content during refresh and clears its readiness on account change', async () => {
    (getRecommendations as jest.Mock).mockResolvedValueOnce(recommendationResponse([{ id: 'dish' }]));
    const wrapper = mountPage(HomePage);
    await flushPromises();
    const pending = deferred();
    (getRecommendations as jest.Mock).mockReturnValueOnce(pending.promise);
    const refreshing = (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(wrapper.text()).toContain('菜品 dish');
    expect(wrapper.html()).not.toMatch(/skeleton/i);
    mockUser.sessionVersion++;
    await wrapper.vm.$nextTick();
    expectUndisclosed(wrapper);
    pending.resolve(recommendationResponse([{ id: 'stale' }]));
    await refreshing;
    await flushPromises();
    expect(wrapper.text()).not.toContain('stale');
  });

  test.each([
    ['canteen', CanteenPage, getCanteenDetail, 'canteen-filter-bar-stub'],
    ['window', WindowPage, getWindowDetail, null],
  ])('%s preserves its route search and withholds uninitialized header and dishes', async (_name, component, api, filter) => {
    const pending = deferred();
    (api as jest.Mock).mockReturnValueOnce(pending.promise);
    const wrapper = mountPage(component);
    expectUndisclosed(wrapper);
    const loading = loadRoute({ id: _name });
    await flushPromises();
    expect(wrapper.find('search-bar-stub').exists()).toBe(true);
    if (filter) expect(wrapper.find(filter).exists()).toBe(true);
    expectUndisclosed(wrapper);
    pending.resolve({ code: 200, data: { id: _name, name: '场所名称' } });
    await loading;
    await flushPromises();
    expect(wrapper.text()).toContain('场所名称');
    expect(wrapper.text()).toContain('暂无菜品信息');
  });

  test.each([
    ['canteen', CanteenPage, getCanteenDetail],
    ['window', WindowPage, getWindowDetail],
  ])('%s first-read failure exposes retry without empty content', async (name, component, api) => {
    (api as jest.Mock).mockRejectedValueOnce(new Error('连接中断'));
    const wrapper = mountPage(component);
    await loadRoute({ id: name });
    await flushPromises();
    expect(wrapper.text()).toContain('连接中断');
    expect(wrapper.text()).not.toContain('暂无');
    await wrapper.get('button').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('暂无菜品信息');
  });

  test('tag route context stays visible while its first result is undisclosed', async () => {
    const pending = deferred();
    (getDishes as jest.Mock).mockReturnValueOnce(pending.promise);
    const wrapper = mountPage(TagPage);
    expectUndisclosed(wrapper);
    loadRoute({ tag: '清淡', canteenId: 'canteen', canteenName: '紫荆' });
    await flushPromises();
    expect(wrapper.text()).toContain('#清淡');
    expect(wrapper.text()).toContain('紫荆');
    expectUndisclosed(wrapper);
    pending.reject(new Error('offline'));
    await flushPromises();
    expect(wrapper.text()).toContain('网络错误');
    expect(wrapper.text()).not.toContain('暂无相关');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('暂无相关菜品');
    mockUser.sessionVersion++;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain('暂无相关');
  });
});

describe('place result ownership', () => {
  test.each([
    ['canteen', useCanteenData, getCanteenDetail, 'dishesInitialized'],
    ['window', useWindowData, getWindowDetail, 'dishesInitialized'],
  ])('%s clears old route content and successful emptiness while the next route is pending', async (_name, setup, api, readiness) => {
    const page = scoped(setup as any) as any;
    await page.init('old');
    expect(page[readiness].value).toBe(true);
    const pending = deferred();
    (api as jest.Mock).mockReturnValueOnce(pending.promise);
    const loading = page.init('new');
    expect(page[readiness].value).toBe(false);
    expect((page.canteenInfo || page.windowInfo).value).toBeNull();
    pending.resolve({ code: 200, data: { id: 'new', name: '新场所' } });
    await loading;
    expect(page[readiness].value).toBe(true);
  });

  test.each([useCanteenData, useWindowData])('retains an existing dish list through refresh failure and account reset removes successful-read state', async setup => {
    (getDishes as jest.Mock).mockResolvedValueOnce(itemsResponse([dish()]));
    const page = scoped(setup as any) as any;
    await page.fetchDishes('place');
    const pending = deferred();
    (getDishes as jest.Mock).mockReturnValueOnce(pending.promise);
    const refreshing = page.fetchDishes('place');
    expect(page.dishes.value).toEqual([dish()]);
    pending.reject(new Error('offline'));
    await refreshing;
    expect(page.dishes.value).toEqual([dish()]);
    expect(page.dishesInitialized.value).toBe(true);
    mockUser.sessionVersion++;
    expect(page.dishes.value).toEqual([]);
    expect(page.dishesInitialized.value).toBe(false);
  });
});

describe('search outcomes', () => {
  test('initial and first pending search preserve the toolbar with no default or skeleton content', async () => {
    const pending = deferred();
    (getDishes as jest.Mock).mockReturnValueOnce(pending.promise);
    const wrapper = mountPage(SearchPage);
    expectUndisclosed(wrapper);
    loadRoute({ windowId: 'window', scopeName: '家常菜' });
    (wrapper.vm as any).keyword = '豆腐';
    const searching = (wrapper.vm as any).handleSearch();
    await flushPromises();
    expect(wrapper.text()).toContain('家常菜');
    expect(wrapper.find('search-bar-stub').exists()).toBe(true);
    expectUndisclosed(wrapper);
    pending.resolve(itemsResponse());
    await searching;
    await flushPromises();
    expect(wrapper.text()).toContain('未找到“豆腐”相关结果');
  });

  test('first search failure and retry expose only outcomes supported by the current query', async () => {
    (getDishes as jest.Mock).mockRejectedValueOnce(new Error('连接中断'));
    const wrapper = mountPage(SearchPage);
    loadRoute({ windowId: 'window' });
    (wrapper.vm as any).keyword = '豆腐';
    await (wrapper.vm as any).handleSearch();
    await flushPromises();
    expect(wrapper.text()).toContain('连接中断');
    expect(wrapper.text()).not.toContain('未找到');
    await wrapper.get('button').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('未找到“豆腐”');
  });

  test('a failed canteen scan cannot turn an empty dish response into a successful global empty search', async () => {
    (getCanteenList as jest.Mock).mockRejectedValueOnce(new Error('食堂查询失败'));
    const wrapper = mountPage(SearchPage);
    (wrapper.vm as any).keyword = '食堂';
    await (wrapper.vm as any).handleSearch();
    await flushPromises();
    expect(wrapper.text()).toContain('食堂查询失败');
    expect(wrapper.text()).not.toContain('未找到');
  });

  test('canteen retry feedback does not block dish pages or their own next-page retry', async () => {
    (getCanteenList as jest.Mock).mockRejectedValueOnce(new Error('食堂目录暂时不可用'));
    (getDishes as jest.Mock)
      .mockResolvedValueOnce(itemsResponse([dish('first')], 1, 2))
      .mockResolvedValueOnce({ code: 503, message: '菜品下一页暂时不可用' })
      .mockResolvedValueOnce(itemsResponse([dish('second')], 2, 2))
      .mockResolvedValueOnce(itemsResponse([dish('refreshed')]));
    const wrapper = mountPage(SearchPage);
    const search = wrapper.vm as any;
    search.keyword = '豆腐';
    await search.handleSearch();
    await flushPromises();
    expect(wrapper.text()).toContain('食堂目录暂时不可用');
    expect(wrapper.text()).toContain('菜品 first');
    expect(search.error).toBe('');
    const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!;
    expect(button('重试食堂搜索').exists()).toBe(true);
    await button('加载更多').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('菜品下一页暂时不可用');
    expect(wrapper.text()).toContain('食堂目录暂时不可用');
    expect(wrapper.text()).toContain('菜品 first');
    await button('重试加载更多').trigger('tap');
    await flushPromises();
    expect(search.searchResults.dishes.map((item: any) => item.id)).toEqual(['first', 'second']);
    expect(search.loadMoreError).toBe('');
    expect((getDishes as jest.Mock).mock.calls.map(([query]) => query.pagination.page)).toEqual([
      1, 2, 2,
    ]);

    search.keyword = '尚未提交的关键词';
    await button('重试食堂搜索').trigger('tap');
    await flushPromises();
    expect(getDishes).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { keyword: '豆腐' } })
    );
    expect(search.keyword).toBe('尚未提交的关键词');
    expect(search.canteenError).toBe('');
    expect(wrapper.text()).not.toContain('重试食堂搜索');
    expect(wrapper.text()).toContain('菜品 refreshed');
  });

  test('a failed dish refresh retains cached results and keeps its own blocking error separate', async () => {
    (getDishes as jest.Mock)
      .mockResolvedValueOnce(itemsResponse([dish()], 1, 2))
      .mockRejectedValueOnce(new Error('菜品刷新失败'));
    const search = scoped(useSearch);
    search.keyword.value = '豆腐';
    await search.search();
    (getCanteenList as jest.Mock).mockRejectedValueOnce(new Error('食堂目录暂时不可用'));
    await search.retrySearch();
    expect(search.searchResults.value.dishes).toEqual([dish()]);
    expect(search.error.value).toBe('菜品刷新失败');
    expect(search.canteenError.value).toBe('食堂目录暂时不可用');
    await search.loadMore();
    expect(getDishes).toHaveBeenCalledTimes(2);
  });

  test.each(['reset', 'scope', 'account'])(
    '%s clears canteen feedback and invalidates an older pending directory failure',
    async ending => {
      (getCanteenList as jest.Mock).mockRejectedValueOnce(new Error('食堂目录暂时不可用'));
      (getDishes as jest.Mock).mockResolvedValueOnce(itemsResponse([dish()]));
      const wrapper = mountPage(SearchPage);
      const search = wrapper.vm as any;
      const invalidate = () => {
        if (ending === 'scope') loadRoute({ windowId: 'new-window' });
        else if (ending === 'account') mockUser.sessionVersion++;
        else search.clearSearch();
      };
      search.keyword = '豆腐';
      await search.search();
      expect(search.canteenError).toBe('食堂目录暂时不可用');
      invalidate();
      await flushPromises();
      expect(search.canteenError).toBe('');
      expect(search.searchResults.dishes).toEqual([]);
      expect(wrapper.text()).not.toContain('食堂目录暂时不可用');

      loadRoute({});
      const pending = deferred();
      (getCanteenList as jest.Mock).mockReturnValueOnce(pending.promise);
      search.keyword = '米饭';
      const searching = search.search();
      invalidate();
      pending.reject(new Error('旧食堂目录错误'));
      await searching;
      await flushPromises();
      expect(search.canteenError).toBe('');
      expect(search.error).toBe('');
      expect(search.searchResults.dishes).toEqual([]);
      expect(getDishes).toHaveBeenCalledTimes(1);
    }
  );

  test('re-submitting the same search preserves results and draft text until its refresh resolves', async () => {
    (getDishes as jest.Mock).mockResolvedValueOnce(itemsResponse([dish()]));
    const search = scoped(() => useSearch(ref({ windowId: 'window' })));
    search.keyword.value = '豆腐';
    await search.search();
    const pending = deferred();
    (getDishes as jest.Mock).mockReturnValueOnce(pending.promise);
    const refreshing = search.search();
    expect(search.searchResults.value.dishes).toEqual([dish()]);
    search.keyword.value = '尚未提交的关键词';
    pending.reject(new Error('offline'));
    await refreshing;
    expect(search.keyword.value).toBe('尚未提交的关键词');
    expect(search.searchResults.value.dishes).toEqual([dish()]);
  });

  test('changing venue scope invalidates pending results while keeping the editable search draft', async () => {
    const wrapper = mountPage(SearchPage);
    const search = wrapper.vm as any;
    loadRoute({ windowId: 'old' });
    const pending = deferred();
    (getDishes as jest.Mock).mockReturnValueOnce(pending.promise);
    search.keyword = '豆腐';
    const searching = search.search();
    search.keyword = '未提交的草稿';
    loadRoute({ windowId: 'new' });
    pending.resolve(itemsResponse([dish('old')]));
    await searching;
    expect(search.searchResults.dishes).toEqual([]);
    expect(search.keyword).toBe('未提交的草稿');
  });
});

describe('dish detail and discussions', () => {
  test('detail first read is blank, then populated content arrives before pending reviews', async () => {
    const detail = deferred();
    const reviews = deferred();
    (getDishById as jest.Mock).mockReturnValueOnce(detail.promise);
    (getReviewsByDish as jest.Mock).mockReturnValueOnce(reviews.promise);
    const wrapper = mountPage(DishPage);
    loadRoute({ id: 'dish' });
    await flushPromises();
    expectUndisclosed(wrapper);
    detail.resolve({ code: 200, data: dish() });
    await flushPromises();
    expect(wrapper.text()).toContain('菜品 dish');
    expect(wrapper.text()).not.toContain('暂无评价');
    expect(wrapper.text()).not.toContain('加载中');
    reviews.resolve(itemsResponse());
    await flushPromises();
    expect(wrapper.text()).toContain('暂无评价');
  });

  test('a failed detail refresh keeps existing content visible beside its retry', async () => {
    const wrapper = mountPage(DishPage);
    loadRoute({ id: 'dish' });
    await flushPromises();
    (getDishById as jest.Mock).mockRejectedValueOnce(new Error('详情刷新失败'));
    await (wrapper.vm as any).refresh();
    await flushPromises();
    expect(wrapper.text()).toContain('详情刷新失败');
    expect(wrapper.text()).toContain('菜品 dish');
    expect(wrapper.find('bottom-review-input-stub').exists()).toBe(true);
  });

  test('same-dish refresh retains related data while a route replacement hides old detail', async () => {
    const detail = scoped(useDishDetail);
    (getDishById as jest.Mock).mockResolvedValueOnce({ code: 200, data: { ...dish(), parentDishId: 'parent' } });
    (getDishById as jest.Mock).mockResolvedValueOnce({ code: 200, data: dish('parent') });
    await detail.fetchDishDetail('dish');
    const pending = deferred();
    (getDishById as jest.Mock).mockReturnValueOnce(pending.promise);
    const refreshing = detail.fetchDishDetail('dish');
    expect(detail.parentDish.value?.id).toBe('parent');
    pending.reject(new Error('offline'));
    await refreshing;
    const replacement = deferred();
    (getDishById as jest.Mock).mockReturnValueOnce(replacement.promise);
    const loading = detail.fetchDishDetail('new');
    expect(detail.dish.value).toBeNull();
    replacement.resolve({ code: 200, data: dish('new') });
    await loading;
    expect(detail.dish.value?.id).toBe('new');
  });

  test('review list reserves emptiness for a successful review read', async () => {
    const review = scoped(useReview);
    const wrapper = mountPage(ReviewList, {
      dishId: 'dish', reviews: [], loading: false, error: '', hasMore: false,
      initialized: false, reviewComments: {}, fetchComments: jest.fn(),
    });
    expect(wrapper.text()).not.toContain('暂无评价');
    (getReviewsByDish as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await review.fetchReviews('dish', true);
    expect((review as any).reviewsInitialized.value).toBe(false);
    await wrapper.setProps({ error: review.reviewsError.value });
    expect(wrapper.text()).not.toContain('暂无评价');
    await review.fetchReviews('dish', true);
    await wrapper.setProps({ initialized: (review as any).reviewsInitialized.value, error: '' });
    expect(wrapper.text()).toContain('暂无评价');
    mockUser.sessionVersion++;
    expect((review as any).reviewsInitialized.value).toBe(false);
  });

  test.each([1, 2])('populated review refresh retry rereads page one when the prior result has %i total pages', async totalPages => {
    const review = (id: string) => ({ id, userId: 'other', userNickname: '食客', rating: 4, content: id, images: [] });
    (getReviewsByDish as jest.Mock)
      .mockResolvedValueOnce(itemsResponse([review('cached')], 1, totalPages))
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(itemsResponse([review('fresh')], 1, 1));
    const wrapper = mountPage(DishPage);
    loadRoute({ id: 'dish' });
    await flushPromises();
    expect(wrapper.text()).toContain('cached');
    expect(await (wrapper.vm as any).fetchDishDetail('dish')).toBe(false);
    await flushPromises();
    expect(wrapper.text()).toContain('cached');
    await wrapper.get('.review-error button').trigger('tap');
    await flushPromises();
    expect((getReviewsByDish as jest.Mock).mock.calls.map(([, pagination]) => pagination.page)).toEqual([1, 1, 1]);
    expect(wrapper.text()).toContain('fresh');
    expect(wrapper.text()).not.toContain('cached');
  });

  test('review append failure retries the same next page without replacing the cached first page', async () => {
    const review = (id: string) => ({ id, userId: 'other', userNickname: '食客', rating: 4, content: id, images: [] });
    (getReviewsByDish as jest.Mock)
      .mockResolvedValueOnce(itemsResponse([review('first')], 1, 2))
      .mockRejectedValueOnce(new Error('append failed'))
      .mockResolvedValueOnce(itemsResponse([review('second')], 2, 2));
    const wrapper = mountPage(DishPage);
    loadRoute({ id: 'dish' });
    await flushPromises();
    await (wrapper.vm as any).loadMoreReviews();
    await flushPromises();
    expect(wrapper.text()).toContain('first');
    await wrapper.get('.review-error button').trigger('tap');
    await flushPromises();
    expect((getReviewsByDish as jest.Mock).mock.calls.map(([, pagination]) => pagination.page)).toEqual([1, 2, 2]);
    expect((wrapper.vm as any).reviews.map((item: any) => item.id)).toEqual(['first', 'second']);
  });

  test('reach-bottom cannot append past a failed populated review refresh before its explicit retry', async () => {
    const review = (id: string) => ({ id, userId: 'other', userNickname: '食客', rating: 4, content: id, images: [] });
    (getReviewsByDish as jest.Mock)
      .mockResolvedValueOnce(itemsResponse([review('cached')], 1, 2))
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(itemsResponse([review('fresh')], 1, 1));
    const wrapper = mountPage(DishPage);
    loadRoute({ id: 'dish' });
    await flushPromises();
    await (wrapper.vm as any).fetchDishDetail('dish');
    await flushPromises();
    const failure = (wrapper.vm as any).reviewsError;
    await (onReachBottom as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(getReviewsByDish).toHaveBeenCalledTimes(2);
    expect((wrapper.vm as any).reviewsError).toBe(failure);
    expect(wrapper.text()).toContain('cached');
    await wrapper.get('.review-error button').trigger('tap');
    await flushPromises();
    expect((getReviewsByDish as jest.Mock).mock.calls.map(([, pagination]) => pagination.page)).toEqual([1, 1, 1]);
    expect(wrapper.text()).toContain('fresh');
  });

  test.each([
    ['parent', 'first'], ['sub', 'first'],
    ['parent', 'cached'], ['sub', 'cached'],
  ])('%s relation timeout on a %s read exposes whole-detail retry and preserves any existing navigation', async (relation, phase) => {
    let failRelation = phase === 'first';
    const currentDish = { ...dish(), ...(relation === 'parent' ? { parentDishId: 'related' } : { subDishId: ['related'] }) };
    (getDishById as jest.Mock).mockImplementation((id: string) => {
      if (id === 'dish') return Promise.resolve({ code: 200, data: currentDish });
      return failRelation
        ? Promise.reject(new Error('请求超时，请重试'))
        : Promise.resolve({ code: 200, data: dish('related') });
    });
    const wrapper = mountPage(DishPage);
    (wrapper.vm as any).dishId = 'dish';
    if (phase === 'cached') {
      expect(await (wrapper.vm as any).fetchDishDetail('dish')).toBe(true);
      failRelation = true;
    }
    expect(await (wrapper.vm as any).fetchDishDetail('dish')).toBe(false);
    await flushPromises();
    expect(wrapper.text()).toContain('请求超时');
    expect(wrapper.text()).toContain('菜品 dish');
    const related = relation === 'parent' ? (wrapper.vm as any).parentDish : (wrapper.vm as any).subDishes[0];
    expect(related?.id).toBe(phase === 'cached' ? 'related' : undefined);
    failRelation = false;
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await wrapper.get('.dish-more-toggle').trigger('click');
    expect(wrapper.text()).toContain('菜品 related');
  });

  test.each(['parent', 'sub'])('%s relation API rejection is not a successful detail read', async relation => {
    const detail = scoped(useDishDetail);
    (getDishById as jest.Mock)
      .mockResolvedValueOnce({ code: 200, data: { ...dish(), ...(relation === 'parent' ? { parentDishId: 'related' } : { subDishId: ['related'] }) } })
      .mockResolvedValueOnce({ code: 503, message: '关联菜品读取失败，请重试' });
    expect(await detail.fetchDishDetail('dish')).toBe(false);
    expect(detail.error.value).toContain('关联菜品读取失败');
  });

  test('reply panel keeps its composer while pending, then gives retry instead of a false empty result', async () => {
    const pending = deferred();
    (getCommentsByReview as jest.Mock).mockReturnValueOnce(pending.promise);
    const wrapper = mountPage(AllCommentsPanel, { reviewId: 'review', isVisible: true });
    await flushPromises();
    expect(wrapper.find('.reply-input').exists()).toBe(true);
    expect(wrapper.text()).toContain('全部回复');
    expectUndisclosed(wrapper);
    (wrapper.vm as any).replyContent = '未发送的回复';
    pending.reject(new Error('offline'));
    await flushPromises();
    expect(wrapper.text()).toContain('回复加载失败');
    expect(wrapper.text()).not.toContain('还没有回复');
    await wrapper.get('.comment-state button').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('还没有回复');
    expect((wrapper.vm as any).replyContent).toBe('未发送的回复');
  });

  test('reply refresh preserves prior content and its draft while a new read is pending', async () => {
    const panel = scoped(() => useCommentPanel(() => 'review'));
    (getCommentsByReview as jest.Mock).mockResolvedValueOnce(itemsResponse([{ id: 'reply' }]));
    await panel.fetchPanelComments();
    panel.replyContent.value = '未发送的回复';
    const pending = deferred();
    (getCommentsByReview as jest.Mock).mockReturnValueOnce(pending.promise);
    const refreshing = panel.refreshComments();
    expect(panel.comments.value).toEqual([{ id: 'reply' }]);
    expect(panel.replyContent.value).toBe('未发送的回复');
    pending.reject(new Error('offline'));
    await refreshing;
    expect((panel as any).initialized.value).toBe(true);
    mockUser.sessionVersion++;
    expect((panel as any).initialized.value).toBe(false);
  });
});
