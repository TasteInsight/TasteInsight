import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ReviewList from '@/pages/dish/components/ReviewList.vue';
import type { Review, Comment } from '@/types/api';

// Mock dayjs
jest.mock('dayjs', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    format: jest.fn(() => '2023-01-01 12:00'),
  })),
}));

// Mock uni.previewImage and uni.showModal
const mockPreviewImage = jest.fn();
const mockShowModal = jest.fn();

(globalThis as any).uni = {
  ...(globalThis as any).uni,
  previewImage: mockPreviewImage,
  showModal: mockShowModal,
};

// Mock useUserStore
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));

describe('ReviewList', () => {
  let mockUseUserStore: any;

  const mockReviews: Review[] = [
    {
      id: '1',
      dishId: 'dish1',
      userId: 'user1',
      userNickname: 'Test User',
      userAvatar: '/avatar.jpg',
      rating: 4,
      content: 'Great dish!',
      images: ['/image1.jpg', '/image2.jpg'],
      status: 'approved',
      createdAt: '2023-01-01T12:00:00Z',
    },
    {
      id: '2',
      dishId: 'dish1',
      userId: 'user2',
      userNickname: 'Another User',
      userAvatar: '',
      rating: 5,
      content: 'Excellent!',
      images: [],
      status: 'approved',
      createdAt: '2023-01-02T12:00:00Z',
    },
  ];

  const mockReviewComments: Record<string, { items: Comment[], total: number, loading: boolean }> = {
    '1': {
      items: [],
      total: 0,
      loading: false,
    },
  };

  const defaultProps = {
    dishId: 'dish1',
    reviews: mockReviews,
    loading: false,
    error: '',
    hasMore: false,
    reviewComments: mockReviewComments,
    fetchComments: jest.fn(),
  };

  beforeEach(() => {
    setActivePinia(createPinia());

    mockUseUserStore = {
      userInfo: { id: 'user1' },
    };

    const { useUserStore } = require('@/store/modules/use-user-store');
    useUserStore.mockReturnValue(mockUseUserStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when loading and no reviews', () => {
    const wrapper = shallowMount(ReviewList, {
      props: {
        ...defaultProps,
        reviews: [],
        loading: true,
      },
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    expect(wrapper.text()).toContain('加载中...');
  });

  it('renders reviews list when reviews exist', () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    expect(wrapper.findAll('.review-item')).toHaveLength(2);
    expect(wrapper.text()).toContain('Test User');
    expect(wrapper.text()).toContain('Another User');
    expect(wrapper.text()).toContain('Great dish!');
    expect(wrapper.text()).toContain('Excellent!');
  });

  it('renders star ratings correctly', () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    const firstReview = wrapper.findAll('.review-item')[0];
    const stars = firstReview.findAll('.star-icon');
    expect(stars).toHaveLength(5);
    expect(stars[0].classes()).toContain('text-yellow-500');
    expect(stars[3].classes()).toContain('text-yellow-500');
    expect(stars[4].classes()).toContain('text-gray-300');
  });

  it('renders review images when present', () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    const firstReview = wrapper.findAll('.review-item')[0];
    const reviewImages = firstReview.findAll('.object-cover');
    expect(reviewImages).toHaveLength(2);
  });

  it('renders empty state when no reviews and not loading', () => {
    const wrapper = shallowMount(ReviewList, {
      props: {
        ...defaultProps,
        reviews: [],
        loading: false,
      },
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    expect(wrapper.text()).toContain('暂无评价，快来抢沙发吧~');
  });

  it('renders error state when error exists', () => {
    const wrapper = shallowMount(ReviewList, {
      props: {
        ...defaultProps,
        error: 'Failed to load reviews',
      },
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Failed to load reviews');
  });

  it('renders load more button when hasMore is true', () => {
    const wrapper = shallowMount(ReviewList, {
      props: {
        ...defaultProps,
        hasMore: true,
      },
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    expect(wrapper.text()).toContain('加载更多 ↓');
  });

  it('renders no more text when no more reviews', () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    expect(wrapper.text()).toContain('没有更多评价了');
  });

  it('emits loadMore event when load more button is clicked', async () => {
    const wrapper = shallowMount(ReviewList, {
      props: {
        ...defaultProps,
        hasMore: true,
      },
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    await wrapper.find('.cursor-pointer').trigger('tap.stop');

    expect(wrapper.emitted('loadMore')).toBeTruthy();
  });

  it('emits viewAllComments event when review is tapped', async () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    const firstReview = wrapper.findAll('.review-item')[0];
    await firstReview.trigger('tap');

    expect(wrapper.emitted('viewAllComments')).toBeTruthy();
    expect(wrapper.emitted('viewAllComments')![0]).toEqual(['1']);
  });

  it('calls uni.previewImage when review image is tapped', async () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    const firstReview = wrapper.findAll('.review-item')[0];
    const reviewImages = firstReview.findAll('.object-cover');
    expect(reviewImages).toHaveLength(2);

    await reviewImages[0].trigger('tap.stop');

    expect(mockPreviewImage).toHaveBeenCalledWith({
      urls: ['/image1.jpg', '/image2.jpg'],
      current: '/image1.jpg',
    });
  });

  it('shows long press menu when review is long pressed', async () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    const firstReview = wrapper.findAll('.review-item')[0];
    await firstReview.trigger('longpress', {});

    const longPressMenu = wrapper.findComponent({ name: 'LongPressMenu' });
    expect(longPressMenu.props('visible')).toBe(true);
    expect(longPressMenu.props('canDelete')).toBe(true); // user1 owns the review
  });

  it('emits delete event when delete is confirmed', async () => {
    mockShowModal.mockImplementation((options: any) => {
      options.success({ confirm: true });
    });

    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    // Trigger long press to show menu
    const firstReview = wrapper.findAll('.review-item')[0];
    await firstReview.trigger('longpress', {});

    // Trigger delete from menu
    const longPressMenu = wrapper.findComponent({ name: 'LongPressMenu' });
    await longPressMenu.vm.$emit('delete');

    expect(mockShowModal).toHaveBeenCalledWith({
      title: '提示',
      content: '确定要删除这条评价吗？',
      success: expect.any(Function),
    });
    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')![0]).toEqual(['1']);
  });

  it('emits report event when report is triggered from menu', async () => {
    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    // Trigger long press to show menu
    const firstReview = wrapper.findAll('.review-item')[0];
    await firstReview.trigger('longpress', {});

    // Trigger report from menu
    const longPressMenu = wrapper.findComponent({ name: 'LongPressMenu' });
    await longPressMenu.vm.$emit('report');

    expect(wrapper.emitted('report')).toBeTruthy();
    expect(wrapper.emitted('report')![0]).toEqual(['1']);
  });

  it('does not allow delete when user does not own the review', async () => {
    mockUseUserStore.userInfo = { id: 'user3' }; // Different user

    const wrapper = shallowMount(ReviewList, {
      props: defaultProps,
      global: {
        stubs: {
          CommentList: true,
          LongPressMenu: true,
        },
      },
    });

    const firstReview = wrapper.findAll('.review-item')[0];
    await firstReview.trigger('longpress', {});

    const longPressMenu = wrapper.findComponent({ name: 'LongPressMenu' });
    expect(longPressMenu.props('canDelete')).toBe(false);
  });
});