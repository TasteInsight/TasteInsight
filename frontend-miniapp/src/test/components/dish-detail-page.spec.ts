import { shallowMount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import DishDetailPage from '@/pages/dish/index.vue';
import TasteProfile from '@/pages/dish/components/TasteProfile.vue';

// Mock uni-app lifecycle hooks
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn((callback: Function) => callback({ id: 'test-dish-id' })),
  onBackPress: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));

// Mock composables
jest.mock('@/pages/dish/composables/use-dish-detail', () => ({
  useDishDetail: jest.fn(),
}));

jest.mock('@/pages/dish/composables/use-report', () => ({
  useReport: jest.fn(),
}));

jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));

describe('DishDetailPage', () => {
  let mockUseDishDetail: any;
  let mockUseReport: any;
  let mockUseUserStore: any;

  beforeEach(() => {
    setActivePinia(createPinia());

    mockUseDishDetail = {
      dish: ref(null),
      loading: ref(false),
      error: ref(''),
      fetchDishDetail: jest.fn(),
      subDishes: ref([]),
      parentDish: ref(null),
      reviews: ref([]),
      ownReview: ref(null),
      ownReviewLoading: ref(false),
      ownReviewLoaded: ref(true),
      ownReviewError: ref(''),
      fetchOwnReview: jest.fn(),
      invalidateOwnReview: jest.fn(),
      deletingReview: ref(false),
      ratingSummary: ref(null),
      reviewsLoading: ref(false),
      reviewsInitialized: ref(true),
      reviewsError: ref(''),
      reviewsHasMore: ref(false),
      fetchReviews: jest.fn(),
      loadMoreReviews: jest.fn(),
      reviewComments: ref({}),
      fetchComments: jest.fn(),
      removeReview: jest.fn(),
      removeComment: jest.fn(),
      isFavorited: ref(false),
      favoriteLoading: ref(false),
      toggleFavorite: jest.fn(),
    };

    mockUseReport = {
      isReportVisible: false,
      openReportModal: jest.fn(),
      closeReportModal: jest.fn(),
      submitReport: jest.fn(),
    };

    mockUseUserStore = {
      userInfo: null,
    };

    const { useDishDetail } = require('@/pages/dish/composables/use-dish-detail');
    const { useReport } = require('@/pages/dish/composables/use-report');
    const { useUserStore } = require('@/store/modules/use-user-store');

    useDishDetail.mockReturnValue(mockUseDishDetail);
    useReport.mockReturnValue(mockUseReport);
    useUserStore.mockReturnValue(mockUseUserStore);
  });

  it('keeps the detail data area undisclosed when loading without a dish', () => {
    mockUseDishDetail.loading.value = true;
    mockUseDishDetail.dish.value = null;

    const wrapper = shallowMount(DishDetailPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          DishDetailSkeleton: true,
          ReviewList: true,
          ReviewForm: true,
          BottomReviewInput: true,
          AllCommentsPanel: true,
          ReportDialog: true,
          RatingBars: true,
          'page-container': true,
        },
      },
    });

    expect(wrapper.findComponent({ name: 'DishDetailSkeleton' }).exists()).toBe(false);
    expect(wrapper.find('.dish-content').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('keeps rating prominent and reveals taste and ingredients only when dish information is expanded', async () => {
    mockUseDishDetail.dish.value = {
      id: 'test-dish-id',
      name: '测试菜品',
      price: 12,
      images: [],
      averageRating: 4,
      reviewCount: 6,
      availableMealTime: ['lunch', 'dinner'],
      allergens: [],
      spicyLevel: 0,
      sweetness: 2,
      saltiness: 3,
      oiliness: 3,
    };
    const wrapper = shallowMount(DishDetailPage, { global: { stubs: { TasteProfile: false } } });
    const summary = wrapper.get('.dish-summary');
    expect(summary.get('.rating-overview').text()).toContain('6 条评价');
    expect(wrapper.findAll('.rating-overview')).toHaveLength(1);
    expect(wrapper.find('.decision-facts').exists()).toBe(false);
    expect(wrapper.get('.dish-more-toggle').text()).toContain('菜品信息');
    expect(wrapper.get('.dish-more-toggle').attributes('aria-expanded')).toBe('false');
    await wrapper.get('.dish-more-toggle').trigger('click');
    expect(wrapper.get('.dish-more-toggle').attributes('aria-expanded')).toBe('true');
    const facts = wrapper.findAll('.decision-row');
    expect(facts[0].get('.decision-value').text()).toBe('午餐、晚餐');
    expect(facts[1].get('.decision-label').text()).toBe('已知过敏原');
    expect(facts[1].get('.decision-value').text()).toBe('暂未提供');
    expect(summary.find('.dish-information-note').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('请向窗口确认');
    expect(wrapper.text()).not.toContain('无过敏原');
    expect(wrapper.text()).not.toContain('/5');
    expect(wrapper.getComponent(TasteProfile).findAll('.taste-profile-item')).toHaveLength(4);
    expect(wrapper.get('[data-taste="spicyLevel"]').text()).toContain('暂无信息');
    expect(wrapper.get('[data-taste="sweetness"]').findAll('.taste-segment-active')).toHaveLength(
      2
    );
    wrapper.unmount();
  });

  it('omits an empty rating distribution while retaining an explicit unrated state', () => {
    mockUseDishDetail.dish.value = {
      id: 'test-dish-id',
      name: '测试菜品',
      price: 12,
      images: [],
      averageRating: 0,
      reviewCount: 0,
    };
    const wrapper = shallowMount(DishDetailPage);
    expect(wrapper.get('.dish-summary .rating-overview').text()).toContain('暂无评分');
    expect(wrapper.findComponent({ name: 'RatingBars' }).exists()).toBe(false);
    wrapper.unmount();
  });

  it('starts my review taste details collapsed without changing its overall rating', async () => {
    mockUseDishDetail.dish.value = {
      id: 'test-dish-id',
      name: '测试菜品',
      price: 12,
      images: [],
      averageRating: 4,
    };
    mockUseUserStore.userInfo = { id: 'A' };
    mockUseDishDetail.ownReview.value = {
      id: 'review',
      userId: 'A',
      createdAt: '2026-10-03T00:00:00Z',
      rating: 4,
      content: '口味记录',
      ratingDetails: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 },
    };
    const wrapper = shallowMount(DishDetailPage, { global: { stubs: { TasteProfile: false } } });
    expect(wrapper.findAllComponents(TasteProfile)).toHaveLength(1);
    expect(wrapper.findComponent({ name: 'BottomReviewInput' }).props('hasReview')).toBe(true);
    expect(wrapper.text()).not.toContain('/5');
    expect(wrapper.text()).toContain('口味记录');
    expect(wrapper.text()).toContain('★');
    const taste = wrapper.getComponent(TasteProfile);
    expect(taste.get('.review-stars').isVisible()).toBe(true);
    expect(taste.get('.taste-grid').isVisible()).toBe(false);
    await taste.get('.taste-toggle').trigger('tap');
    expect(taste.get('.taste-grid').isVisible()).toBe(true);
    expect(taste.get('[data-taste="oiliness"]').findAll('.taste-segment-active')).toHaveLength(4);
    wrapper.unmount();
  });

  it('closes a saved review form without a redundant success toast', async () => {
    mockUseDishDetail.dish.value = { id: 'test-dish-id', name: '菜品', price: 0, images: [] };
    mockUseUserStore.userInfo = { id: 'A' };
    const wrapper = shallowMount(DishDetailPage);
    try {
      wrapper.getComponent({ name: 'BottomReviewInput' }).vm.$emit('review');
      await flushPromises();
      wrapper.getComponent({ name: 'ReviewForm' }).vm.$emit('success', {
        id: 'pending-review',
        dishId: 'test-dish-id',
        userId: 'A',
        userNickname: 'A',
        userAvatar: '',
        rating: 4,
        ratingDetails: null,
        content: '保存的评价',
        images: [],
        status: 'pending',
        createdAt: '2026-10-08T12:00:00Z',
      });
      await flushPromises();
      expect(wrapper.findComponent({ name: 'ReviewForm' }).exists()).toBe(false);
      expect(mockUseDishDetail.ownReview.value).toMatchObject({
        id: 'pending-review',
        content: '保存的评价',
        status: 'pending',
      });
      expect(uni.showToast).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });

  it('renders error state when error exists', () => {
    mockUseDishDetail.loading.value = false;
    mockUseDishDetail.error.value = '加载失败';
    mockUseDishDetail.dish.value = null;

    const wrapper = shallowMount(DishDetailPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          DishDetailSkeleton: true,
          ReviewList: true,
          ReviewForm: true,
          BottomReviewInput: true,
          AllCommentsPanel: true,
          ReportDialog: true,
          RatingBars: true,
          'page-container': true,
        },
      },
    });

    expect(wrapper.text()).toContain('加载失败');
    expect(wrapper.find('button').text()).toBe('重试');
  });

  it('blocks empty review creation after an ownership read failure and exposes local retry', async () => {
    mockUseDishDetail.dish.value = { id: 'test-dish-id', name: '菜品', price: 0, images: [] };
    mockUseDishDetail.ownReviewLoaded.value = false;
    mockUseDishDetail.ownReviewError.value = '我的评价暂时无法读取，请重试后再编辑';
    const wrapper = shallowMount(DishDetailPage);
    const action = wrapper.getComponent({ name: 'BottomReviewInput' });
    expect(action.props('reviewDisabled')).toBe(true);
    action.vm.$emit('review');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'ReviewForm' }).exists()).toBe(false);
    await wrapper.get('.review-state button').trigger('tap');
    expect(mockUseDishDetail.fetchOwnReview).toHaveBeenCalledWith('test-dish-id');
    wrapper.unmount();
  });

  it('shows a pending owned review even when no public reviews are loaded', () => {
    mockUseDishDetail.dish.value = { id: 'test-dish-id', name: '菜品', price: 0, images: [] };
    mockUseDishDetail.ownReview.value = {
      id: 'old',
      userId: 'A',
      status: 'pending',
      rating: 4,
      content: '保留原内容',
      images: [],
    };
    const wrapper = shallowMount(DishDetailPage);
    expect(wrapper.findComponent({ name: 'BottomReviewInput' }).props('hasReview')).toBe(true);
    expect(wrapper.text()).toContain('保留原内容');
    expect(wrapper.text()).not.toMatch(/待审核|审核通过后|仅你可见/);
    expect(wrapper.find('.own-review-status').exists()).toBe(false);
    expect(wrapper.find('.own-review-meta button').exists()).toBe(false);
    expect(mockUseDishDetail.reviews.value).toEqual([]);
    wrapper.unmount();
  });

  it('renders dish content when dish exists', () => {
    const mockDish = {
      id: '1',
      name: '测试菜品',
      images: ['image1.jpg'],
      averageRating: 4.5,
      price: 15.0,
    };
    mockUseDishDetail.loading.value = false;
    mockUseDishDetail.error.value = '';
    mockUseDishDetail.dish.value = mockDish;

    const wrapper = shallowMount(DishDetailPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          DishDetailSkeleton: true,
          ReviewList: true,
          ReviewForm: true,
          BottomReviewInput: true,
          AllCommentsPanel: true,
          ReportDialog: true,
          RatingBars: true,
          'page-container': true,
        },
      },
    });

    expect(wrapper.findComponent({ name: 'DishDetailSkeleton' }).exists()).toBe(false);
    expect(wrapper.find('.dish-swiper').exists()).toBe(true);
  });

  it('calls refresh on retry button click', async () => {
    mockUseDishDetail.loading.value = false;
    mockUseDishDetail.error.value = '错误';
    mockUseDishDetail.dish.value = null;
    mockUseDishDetail.fetchDishDetail = jest.fn();

    const wrapper = shallowMount(DishDetailPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          DishDetailSkeleton: true,
          ReviewList: true,
          ReviewForm: true,
          BottomReviewInput: true,
          AllCommentsPanel: true,
          ReportDialog: true,
          RatingBars: true,
          'page-container': true,
          // Don't stub button so we can test the click
        },
      },
    });

    // onLoad is automatically called with { id: 'test-dish-id' } during component setup

    // Find the retry button in the error state
    const retryButton = wrapper.find('button');
    expect(retryButton.exists()).toBe(true);
    expect(retryButton.text()).toContain('重试');

    await retryButton.trigger('click');
    expect(mockUseDishDetail.fetchDishDetail).toHaveBeenCalledWith('test-dish-id');
  });
});
