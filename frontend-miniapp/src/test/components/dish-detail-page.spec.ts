import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DishDetailPage from '@/pages/dish/index.vue';

// Mock uni-app lifecycle hooks
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn((callback: Function) => callback({ id: 'test-dish-id' })),
  onBackPress: jest.fn(),
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
      dish: null,
      loading: false,
      error: '',
      fetchDishDetail: jest.fn(),
      subDishes: [],
      parentDish: null,
      reviews: [],
      reviewsLoading: false,
      reviewsError: '',
      reviewsHasMore: false,
      fetchReviews: jest.fn(),
      loadMoreReviews: jest.fn(),
      reviewComments: [],
      fetchComments: jest.fn(),
      removeReview: jest.fn(),
      removeComment: jest.fn(),
      isFavorited: false,
      favoriteLoading: false,
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

  it('renders skeleton when loading and no dish', () => {
    mockUseDishDetail.loading = true;
    mockUseDishDetail.dish = null;

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

    expect(wrapper.findComponent({ name: 'DishDetailSkeleton' }).exists()).toBe(true);
  });

  it('renders error state when error exists', () => {
    mockUseDishDetail.loading = false;
    mockUseDishDetail.error = '加载失败';
    mockUseDishDetail.dish = null;

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

  it('renders dish content when dish exists', () => {
    const mockDish = { 
      id: '1', 
      name: '测试菜品', 
      images: ['image1.jpg'],
      averageRating: 4.5,
      price: 15.0
    };
    mockUseDishDetail.loading = false;
    mockUseDishDetail.error = null;
    mockUseDishDetail.dish = mockDish;

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
    mockUseDishDetail.loading = false;
    mockUseDishDetail.error = '错误';
    mockUseDishDetail.dish = null;
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
