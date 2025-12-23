import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import IndexPage from '@/pages/index/index.vue';

// Mock uni-app lifecycle hooks
jest.mock('@dcloudio/uni-app', () => ({
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));

// Mock stores
jest.mock('@/store/modules/use-canteen-store', () => ({
  useCanteenStore: jest.fn(() => ({
    canteenList: [],
    loading: false,
    error: null,
    fetchCanteenList: jest.fn(),
  })),
}));

jest.mock('@/store/modules/use-dishes-store', () => ({
  useDishesStore: jest.fn(() => ({
    dishesImages: [],
    loading: false,
    error: null,
    dishes: [],
    fetchDishes: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(() => ({
    userInfo: null,
    isLoggedIn: false,
    fetchProfileAction: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock API
jest.mock('@/api/modules/dish', () => ({
  getDishesImages: jest.fn().mockResolvedValue({
    code: 200,
    data: { images: ['image1.jpg', 'image2.jpg'] },
  }),
}));

describe('IndexPage', () => {
  let mockCanteenStore: any;
  let mockDishesStore: any;
  let mockUserStore: any;

  beforeEach(() => {
    setActivePinia(createPinia());

    mockCanteenStore = {
      loading: false,
      error: null,
      canteenList: [],
      fetchCanteenList: jest.fn().mockResolvedValue(undefined),
    };

    mockDishesStore = {
      loading: false,
      error: null,
      dishes: [],
      dishesImages: [],
      fetchDishes: jest.fn().mockResolvedValue(undefined),
    };

    mockUserStore = {
      userInfo: null,
      isLoggedIn: false,
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
    };

    const { useCanteenStore } = require('@/store/modules/use-canteen-store');
    const { useDishesStore } = require('@/store/modules/use-dishes-store');
    const { useUserStore } = require('@/store/modules/use-user-store');

    useCanteenStore.mockReturnValue(mockCanteenStore);
    useDishesStore.mockReturnValue(mockDishesStore);
    useUserStore.mockReturnValue(mockUserStore);
  });

  it('renders skeleton when initially loading', () => {
    mockCanteenStore.loading = true;
    mockDishesStore.loading = true;

    const wrapper = shallowMount(IndexPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          IndexSkeleton: true,
          SearchBar: true,
          CanteenItem: true,
          FilterBar: true,
          RecommendItem: true,
        },
      },
    });

    expect(wrapper.findComponent({ name: 'IndexSkeleton' }).exists()).toBe(true);
  });

  it('renders main content when not loading', async () => {
    const wrapper = shallowMount(IndexPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          IndexSkeleton: true,
          SearchBar: true,
          CanteenItem: true,
          FilterBar: true,
          RecommendItem: true,
        },
      },
    });

    // Wait for onMounted to complete and async operations to finish
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promises to resolve

    expect(wrapper.findComponent({ name: 'IndexSkeleton' }).exists()).toBe(false);
    expect(wrapper.find('.dish-image-swiper').exists()).toBe(true);
  });

  it('shows canteen loading state', async () => {
    mockCanteenStore.loading = true;

    const wrapper = shallowMount(IndexPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          IndexSkeleton: true,
          SearchBar: true,
          CanteenItem: true,
          FilterBar: true,
          RecommendItem: true,
        },
      },
    });

    // Wait for onMounted to complete and async operations to finish
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('正在加载食堂...');
  });

  it('shows canteen error state', async () => {
    mockCanteenStore.error = '网络错误';

    const wrapper = shallowMount(IndexPage, {
      global: {
        stubs: {
          swiper: true,
          'swiper-item': true,
          IndexSkeleton: true,
          SearchBar: true,
          CanteenItem: true,
          FilterBar: true,
          RecommendItem: true,
        },
      },
    });

    // Wait for onMounted to complete and async operations to finish
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('网络错误');
  });
});
