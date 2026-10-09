import { ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import {
  onLoad,
  onPullDownRefresh,
  onReachBottom,
  onBackPress,
  onHide,
  onShow,
} from '@dcloudio/uni-app';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import FilterBar from '@/pages/index/components/FilterBar.vue';
import CanteenDishCard from '@/pages/canteen/components/CanteenDishCard.vue';
import ProfileDishCard from '@/pages/profile/components/ProfileDishCard.vue';
import TagList from '@/pages/dish/components/TagList.vue';
import FavoritesPage from '@/pages/profile/my-favorites/index.vue';
import HistoryPage from '@/pages/profile/history/index.vue';
import CanteenPage from '@/pages/canteen/index.vue';
import WindowPage from '@/pages/window/index.vue';
import { getDishes, unfavoriteDish } from '@/api/modules/dish';
import { getMyFavorites, getBrowseHistory } from '@/api/modules/user';
import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useWindowData } from '@/pages/window/composables/use-window-data';

jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onBackPress: jest.fn(),
  onHide: jest.fn(),
}));
jest.mock('@/api/modules/dish', () => ({ getDishes: jest.fn(), unfavoriteDish: jest.fn() }));
jest.mock('@/api/modules/user', () => ({ getMyFavorites: jest.fn(), getBrowseHistory: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ isLoggedIn: true, sessionVersion: 0 }),
}));
jest.mock('@/pages/canteen/composables/use-canteen-data', () => ({ useCanteenData: jest.fn() }));
jest.mock('@/pages/window/composables/use-window-data', () => ({ useWindowData: jest.fn() }));

const dish = {
  id: 'dish-1',
  name: '家常豆腐',
  images: ['https://images.test/failed.jpg'],
  price: 12.5,
  averageRating: 4.2,
  reviewCount: 8,
  canteenName: '第一食堂',
  windowName: '家常菜窗口',
  tags: ['家常菜'],
};
const savedDish = {
  dishId: dish.id,
  dishName: dish.name,
  dishImages: dish.images,
  dishPrice: dish.price,
  averageRating: dish.averageRating,
  canteenName: dish.canteenName,
  windowName: dish.windowName,
  tags: dish.tags,
};
const pageResponse = (items: any[], totalPages = 1) => ({
  code: 200,
  data: { items, meta: { page: 1, totalPages } },
});
const wrappers: any[] = [];
const mountPage = (Page: any, stubs: Record<string, any> = {}) => {
  const wrapper = mount(Page, {
    global: {
      stubs: {
        DishListSkeleton: true,
        TagListSkeleton: true,
        CanteenSkeleton: true,
        WindowSkeleton: true,
        CanteenHeader: true,
        WindowHeader: true,
        SearchBar: true,
        CanteenFilterBar: true,
        CanteenWindowList: true,
        ...stubs,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
};

beforeEach(() => {
  jest.clearAllMocks();
  (uni as any).setNavigationBarTitle = jest.fn();
  (getDishes as jest.Mock).mockReset().mockResolvedValue(pageResponse([dish]));
  (getMyFavorites as jest.Mock).mockReset().mockResolvedValue(pageResponse([savedDish]));
  (getBrowseHistory as jest.Mock).mockReset().mockResolvedValue(pageResponse([savedDish]));
  (unfavoriteDish as jest.Mock).mockReset().mockResolvedValue({ code: 200 });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

describe('shared list card contracts', () => {
  test('places optional media after the copy and removes the column when unavailable', async () => {
    const wrapper = mount(DishSummaryCard, { props: { dish: dish as any } });
    wrappers.push(wrapper);
    expect(
      Array.from(wrapper.get('.dish-card').element.children).map(node => node.className)
    ).toEqual(['dish-card__body', 'dish-card__photo']);
    await wrapper.get('.dish-card__image').trigger('error');
    expect(wrapper.find('.dish-card__photo').exists()).toBe(false);
    expect(wrapper.get('.dish-card__body').text()).toContain('家常豆腐');
    await wrapper.setProps({ dish: { ...dish, images: [] } });
    expect(wrapper.find('image').exists()).toBe(false);
  });

  test('preserves the canteen card id event without performing a second navigation', async () => {
    const wrapper = mount(CanteenDishCard, { props: { dish: dish as any } });
    wrappers.push(wrapper);
    expect(wrapper.findComponent(DishSummaryCard).props('dish')).toEqual(dish);
    await wrapper.get('.dish-card').trigger('click');
    expect(wrapper.emitted('click')).toEqual([[dish.id]]);
    expect(uni.navigateTo).not.toHaveBeenCalled();
    await wrapper.get('.dish-card__image').trigger('error');
    expect(wrapper.find('.dish-card__photo').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('暂无图片');
  });

  test('keeps profile selection and unfavorite separate without nested buttons', async () => {
    const wrapper = mount(ProfileDishCard, { props: { dish: dish as any, showFavorite: true } });
    wrappers.push(wrapper);
    expect(wrapper.find('button button').exists()).toBe(false);
    await wrapper.get('.dish-card').trigger('click');
    expect(wrapper.emitted('click')).toEqual([[]]);
    await wrapper.get('.profile-dish__unfavorite').trigger('click');
    expect(wrapper.emitted('unfavorite')).toEqual([[]]);
    expect(wrapper.emitted('click')).toHaveLength(1);
    expect(uni.navigateTo).not.toHaveBeenCalled();
  });
});

describe('tag list page', () => {
  const openTag = async () => {
    const wrapper = mountPage(TagList);
    (onLoad as jest.Mock).mock.calls[0][0]({
      tag: encodeURIComponent('家常菜'),
      canteenId: 'canteen-1',
      canteenName: encodeURIComponent('第一食堂'),
    });
    await flushPromises();
    return wrapper;
  };

  test('renders the shared card while retaining the tag query, pagination and one detail navigation', async () => {
    (getDishes as jest.Mock).mockResolvedValueOnce(
      pageResponse(
        Array.from({ length: 10 }, (_, i) => ({ ...dish, id: `dish-${i}` })),
        2
      )
    );
    const wrapper = await openTag();
    expect(wrapper.get('.dish-list-title').text()).toBe('#家常菜');
    expect(uni.setNavigationBarTitle).toHaveBeenCalledWith({ title: '标签菜品' });
    expect(wrapper.findAllComponents(DishSummaryCard)).toHaveLength(10);
    expect(getDishes).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { tag: ['家常菜'], canteenId: ['canteen-1'], includeOffline: false },
        pagination: { page: 1, pageSize: 10 },
      })
    );
    await wrapper.get('.dish-card').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/dish/index?id=dish-0' });
    (getDishes as jest.Mock).mockResolvedValueOnce(pageResponse([{ ...dish, id: 'last-dish' }]));
    await (onReachBottom as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(getDishes).toHaveBeenLastCalledWith(
      expect.objectContaining({ pagination: { page: 2, pageSize: 10 } })
    );
    expect(wrapper.findAllComponents(DishSummaryCard)).toHaveLength(11);
  });

  test('shows a retryable error separately from a successful empty result', async () => {
    (getDishes as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const wrapper = await openTag();
    expect(wrapper.text()).toContain('网络错误，请稍后重试');
    expect(wrapper.text()).not.toContain('暂无相关菜品');
    (getDishes as jest.Mock).mockResolvedValueOnce(pageResponse([]));
    await wrapper.get('.dish-list-action').trigger('click');
    await flushPromises();
    expect(getDishes).toHaveBeenLastCalledWith(
      expect.objectContaining({ pagination: { page: 1, pageSize: 10 } })
    );
    expect(wrapper.text()).toContain('暂无相关菜品');
  });
});

describe('saved dish pages', () => {
  test('favorites retains cancellation through the real composable without opening the dish', async () => {
    const wrapper = mountPage(FavoritesPage);
    await (onShow as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(getMyFavorites).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(wrapper.findComponent(DishSummaryCard).props('dish').reviewCount).toBeUndefined();
    expect(wrapper.find('.dish-card__reviews').exists()).toBe(false);
    (getMyFavorites as jest.Mock).mockResolvedValueOnce(pageResponse([]));
    await wrapper.get('.profile-dish__unfavorite').trigger('click');
    await flushPromises();
    expect(unfavoriteDish).toHaveBeenCalledWith(dish.id);
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('暂无收藏');
  });

  test('history retains its detail failure feedback and load-more query without adding removal actions', async () => {
    (getBrowseHistory as jest.Mock).mockResolvedValueOnce(pageResponse([savedDish], 2));
    const wrapper = mountPage(HistoryPage);
    await (onShow as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(wrapper.find('.profile-dish__unfavorite').exists()).toBe(false);
    await wrapper.get('.dish-card').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    const navigation = (uni.navigateTo as jest.Mock).mock.calls[0][0];
    expect(navigation.url).toBe('/pages/dish/index?id=dish-1');
    navigation.fail();
    expect(uni.showToast).toHaveBeenCalledWith({ title: '页面跳转失败', icon: 'none' });
    await wrapper.get('.dish-list-action').trigger('click');
    await flushPromises();
    expect(getBrowseHistory).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 });
  });

  test.each([
    [FavoritesPage, getMyFavorites, '暂无收藏'],
    [HistoryPage, getBrowseHistory, '暂无浏览历史'],
  ])('does not label a failed personal list as empty', async (Page, api, emptyText) => {
    (api as jest.Mock).mockRejectedValueOnce(new Error('列表加载失败'));
    const wrapper = mountPage(Page);
    await (onShow as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(wrapper.text()).toContain('列表加载失败');
    expect(wrapper.text()).not.toContain(emptyText);
    await wrapper.get('.dish-list-action').trigger('click');
    await flushPromises();
    expect(api).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
    expect(wrapper.findComponent(DishSummaryCard).exists()).toBe(true);
  });
});

describe('canteen and window card consumers', () => {
  test('keeps the real canteen filter controlled and closes its sheet on native back, hiding and miniapp back', async () => {
    const fetchDishes = jest.fn();
    (useCanteenData as jest.Mock).mockReturnValue({
      canteenInfo: ref(null),
      loading: ref(false),
      error: ref(''),
      windows: ref([]),
      dishes: ref([dish]),
      dishesLoading: ref(false),
      dishesError: ref(''),
      retryDishes: jest.fn(),
      refreshPreferredSort: jest.fn(),
      dishesLoadingMore: ref(false),
      hasMore: ref(true),
      beginOperation: () => () => true,
      init: jest.fn(),
      fetchDishes,
      loadMoreDishes: jest.fn(),
    });
    const wrapper = mountPage(CanteenPage, { CanteenFilterBar: false, slider: true });
    await (onLoad as jest.Mock).mock.calls[0][0]({ id: 'canteen-1' });
    await flushPromises();
    const filter = wrapper.findComponent(FilterBar);
    await filter.get('.filter-trigger').trigger('click');
    await filter
      .findAll('button')
      .find((item: any) => item.text() === '午餐')!
      .trigger('click');
    await filter.get('.filter-apply').trigger('click');
    expect(fetchDishes).toHaveBeenLastCalledWith('canteen-1', { mealTime: ['lunch'] });
    expect(filter.props('filter')).toEqual({ mealTime: ['lunch'] });
    expect(filter.find('[aria-label="移除午餐"]').exists()).toBe(true);

    await filter.get('.filter-trigger').trigger('click');
    await filter
      .findAll('button')
      .find((item: any) => item.text() === '晚餐')!
      .trigger('click');
    const onBack = (onBackPress as jest.Mock).mock.calls[0][0];
    expect(onBack()).toBe(true);
    await wrapper.vm.$nextTick();
    expect(filter.find('.filter-sheet').exists()).toBe(false);
    expect(onBack()).toBe(false);
    expect(filter.props('filter')).toEqual({ mealTime: ['lunch'] });
    expect(fetchDishes).toHaveBeenCalledTimes(1);

    await filter.get('.filter-trigger').trigger('click');
    (onHide as jest.Mock).mock.calls[0][0]();
    await wrapper.vm.$nextTick();
    expect(filter.find('.filter-sheet').exists()).toBe(false);
    await filter.get('.filter-trigger').trigger('click');
    await wrapper.get('[data-testid="canteen-filter-back-helper"]').trigger('leave');
    expect(filter.find('.filter-sheet').exists()).toBe(false);
    await filter.get('[aria-label="移除午餐"]').trigger('click');
    expect(fetchDishes).toHaveBeenLastCalledWith('canteen-1', {});
    expect(filter.props('filter')).toEqual({});
  });

  test('canteen retains dish selection, window selection and page-end loading', async () => {
    const loadMoreDishes = jest.fn();
    (useCanteenData as jest.Mock).mockReturnValue({
      canteenInfo: ref(null),
      loading: ref(false),
      error: ref(''),
      windows: ref([]),
      dishes: ref([dish]),
      dishesLoading: ref(false),
      dishesError: ref(''),
      retryDishes: jest.fn(),
      refreshPreferredSort: jest.fn(),
      dishesLoadingMore: ref(false),
      hasMore: ref(true),
      beginOperation: () => () => true,
      init: jest.fn(),
      fetchDishes: jest.fn(),
      loadMoreDishes,
    });
    const wrapper = mountPage(CanteenPage);
    await (onLoad as jest.Mock).mock.calls[0][0]({ id: 'canteen-1' });
    await flushPromises();
    expect(wrapper.findComponent(DishSummaryCard).exists()).toBe(true);
    await wrapper.get('.dish-card').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/dish/index?id=dish-1' });
    wrapper.findComponent({ name: 'CanteenWindowList' }).vm.$emit('click', 'window-1');
    expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/window/index?id=window-1' });
    await (onReachBottom as jest.Mock).mock.calls[0][0]();
    expect(loadMoreDishes).toHaveBeenCalledTimes(1);
  });

  test('window reuses the summary and keeps scroll loading for the current window', async () => {
    const loadMoreDishes = jest.fn();
    (useWindowData as jest.Mock).mockReturnValue({
      windowInfo: ref(null),
      headerLoading: ref(false),
      headerError: ref(''),
      retryDishes: jest.fn(),
      refreshPreferredSort: jest.fn(),
      loading: ref(false),
      loadingMore: ref(false),
      hasMore: ref(true),
      error: ref(''),
      dishes: ref([dish]),
      beginOperation: () => () => true,
      init: jest.fn(),
      fetchDishes: jest.fn(),
      fetchWindow: jest.fn(),
      loadMoreDishes,
    });
    const wrapper = mountPage(WindowPage);
    await (onLoad as jest.Mock).mock.calls[0][0]({ id: 'window-1' });
    await flushPromises();
    expect(wrapper.findComponent(DishSummaryCard).exists()).toBe(true);
    await wrapper.get('.dish-card').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    await wrapper.get('[scroll-y]').trigger('scrolltolower');
    expect(loadMoreDishes).toHaveBeenCalledWith('window-1');
  });
});
