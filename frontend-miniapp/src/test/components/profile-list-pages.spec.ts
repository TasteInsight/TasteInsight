import { shallowMount } from '@vue/test-utils';
import { ref } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import ReviewsPage from '@/pages/profile/my-reviews/index.vue';
import FavoritesPage from '@/pages/profile/my-favorites/index.vue';
import HistoryPage from '@/pages/profile/history/index.vue';
import { useMyReviews } from '@/pages/profile/my-reviews/composables/use-my-reviews';
import { useFavorites } from '@/pages/profile/my-favorites/composables/use-favorites';
import { useHistory } from '@/pages/profile/history/composables/use-history';

jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/pages/profile/my-reviews/composables/use-my-reviews', () => ({
  useMyReviews: jest.fn(),
}));
jest.mock('@/pages/profile/my-favorites/composables/use-favorites', () => ({
  useFavorites: jest.fn(),
}));
jest.mock('@/pages/profile/history/composables/use-history', () => ({ useHistory: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
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
      [itemsKey]: ref([{ id: 'r', dishId: 'd', dishName: '菜品', rating: 4, content: '评价内容' }]),
      loading: ref(false),
      error: ref('网络错误'),
      hasMore: ref(true),
      refresh,
      loadMore: jest.fn(),
      retry: jest.fn(),
      removeFavorite: jest.fn(),
      removingIds: ref([]),
    };
    (useList as jest.Mock).mockReturnValue(state);
    const wrapper = shallowMount(Page as any);
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
