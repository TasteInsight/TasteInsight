import { mount, shallowMount } from '@vue/test-utils';
import { ref } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import ReviewsPage from '@/pages/profile/records/my-reviews/index.vue';
import FavoritesPage from '@/pages/profile/records/my-favorites/index.vue';
import HistoryPage from '@/pages/profile/records/history/index.vue';
import { useMyReviews } from '@/pages/profile/composables/use-my-reviews';
import { useFavorites } from '@/pages/profile/records/my-favorites/composables/use-favorites';
import { useHistory } from '@/pages/profile/records/history/composables/use-history';

jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/pages/profile/composables/use-my-reviews', () => ({
  useMyReviews: jest.fn(),
}));
jest.mock('@/pages/profile/records/my-favorites/composables/use-favorites', () => ({
  useFavorites: jest.fn(),
}));
jest.mock('@/pages/profile/records/history/composables/use-history', () => ({ useHistory: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (useUserStore as unknown as jest.Mock).mockReturnValue({ isLoggedIn: true });
  Object.assign(uni, { showToast: jest.fn(), stopPullDownRefresh: jest.fn() });
});

it.each([
  ['reviews', ReviewsPage, useMyReviews, 'reviews', 'ReviewCard'],
  ['favorites', FavoritesPage, useFavorites, 'favoriteItems', 'DishCard'],
  ['history', HistoryPage, useHistory, 'historyItems', 'DishCard'],
] as const)(
  '%s loads only from onShow, retains cards on failure, and never reports failed refresh as success',
  async (_name, Page, useList, itemsKey, cardName) => {
    const refresh = jest.fn().mockResolvedValue(false);
    const state = {
      isLoggedIn: ref(true),
      [itemsKey]: ref([{ id: 'r', dishId: 'd', dishName: '菜品', rating: 4, content: '评价内容' }]),
      loading: ref(false),
      initialized: ref(true),
      error: ref('网络错误'),
      hasMore: ref(true),
      refresh,
      loadMore: jest.fn(),
      retry: jest.fn(),
      removeFavorite: jest.fn(),
      removingIds: ref([]),
    };
    (useList as jest.Mock).mockReturnValue(state);
    const wrapper = shallowMount(Page as any, {
      global: { stubs: { LoginGate: false, AsyncState: false, EmptyState: false } },
    });
    expect(refresh).not.toHaveBeenCalled();
    const show = (onShow as jest.Mock).mock.calls[0][0];
    await show();
    expect(refresh).toHaveBeenCalledTimes(1);
    await show();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(wrapper.findComponent({ name: cardName }).exists()).toBe(true);
    expect(wrapper.text()).toContain('网络错误');
    await (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
    expect(uni.showToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: '刷新成功' }));
    expect(uni.stopPullDownRefresh).toHaveBeenCalled();
    wrapper.unmount();
  }
);

it.each([
  ['reviews', ReviewsPage, useMyReviews, 'reviews', '暂无评价'],
  ['favorites', FavoritesPage, useFavorites, 'favoriteItems', '暂无收藏'],
  ['history', HistoryPage, useHistory, 'historyItems', '暂无浏览历史'],
] as const)(
  '%s gives loading precedence during an empty refresh and gates guest access',
  async (_name, Page, useList, itemsKey, emptyTitle) => {
    const state = {
      [itemsKey]: ref([]),
      loading: ref(true),
      initialized: ref(true),
      error: ref(''),
      hasMore: ref(false),
      refresh: jest.fn(),
      loadMore: jest.fn(),
      retry: jest.fn(),
      removeFavorite: jest.fn(),
      removingIds: ref([]),
    };
    (useList as jest.Mock).mockReturnValue(state);
    const options = {
      global: { stubs: { LoginGate: false, AsyncState: false, EmptyState: false } },
    };
    const wrapper = shallowMount(Page as any, options);
    expect(wrapper.text()).toContain('正在加载…');
    expect(wrapper.text()).not.toContain(emptyTitle);
    state.loading.value = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain(emptyTitle);
    wrapper.unmount();
    (useUserStore as unknown as jest.Mock).mockReturnValue({ isLoggedIn: false });
    const guest = shallowMount(Page as any, options);
    expect(guest.text()).toContain('登录后查看个人记录');
    expect(guest.find('.dish-list-content').exists()).toBe(false);
    guest.unmount();
  }
);

it.each([
  [FavoritesPage, useFavorites, 'favoriteItems'],
  [HistoryPage, useHistory, 'historyItems'],
] as const)(
  'preserves source price, unit and status through the personal list projection',
  async (Page, useList, itemsKey) => {
    const items = ref([
      {
        dishId: 'd',
        dishName: '菜品',
        dishImages: [],
        dishPrice: 10.01,
        priceUnit: '元/100g',
        status: 'offline',
        calories: 0,
        protein: null,
        canteenName: '食堂',
        windowName: '窗口',
        tags: [],
        averageRating: 0,
      },
    ]);
    (useList as jest.Mock).mockReturnValue({
      isLoggedIn: ref(true),
      [itemsKey]: items,
      loading: ref(false),
      initialized: ref(true),
      error: ref(null),
      hasMore: ref(false),
      refresh: jest.fn(),
      loadMore: jest.fn(),
      retry: jest.fn(),
      removeFavorite: jest.fn(),
      removingIds: ref([]),
    });
    const wrapper = mount(Page as any);
    expect(wrapper.get('.dish-card__price').text()).toBe('¥10.01/100g');
    expect(wrapper.get('.tag-badge--neutral').text()).toBe('已下架');
    expect(wrapper.text()).toContain('热量 0 kcal');
    expect(wrapper.text()).not.toContain('蛋白质');
    items.value = [{ ...items.value[0], dishPrice: 0, priceUnit: null as any, status: 'online' }];
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.dish-card__price').text()).toBe('¥0.00');
    expect(wrapper.find('.tag-badge--neutral').exists()).toBe(false);
    wrapper.unmount();
  }
);
