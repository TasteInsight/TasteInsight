import { defineComponent, reactive, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { onPullDownRefresh, onBackPress, onHide } from '@dcloudio/uni-app';
import IndexPage from '@/pages/index/index.vue';
import CanteenEntry from '../CanteenList.vue';
import SearchBar from '@/components/SearchBar.vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import { useUserStore } from '@/store/modules/use-user-store';
import { getCanteenList } from '@/api/modules/canteen';
import { getRecommendations } from '@/api/modules/recommendation';
import { getDishesByIds } from '@/api/modules/dish';

jest.mock('@dcloudio/uni-app', () => ({
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onShow: jest.fn(),
  onBackPress: jest.fn(),
  onHide: jest.fn(),
}));
jest.mock('@/store/modules/use-canteen-store', () => ({ useCanteenStore: jest.fn() }));
jest.mock('@/store/modules/use-dishes-store', () => ({ useDishesStore: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/api/modules/canteen', () => ({ getCanteenList: jest.fn() }));
jest.mock('@/api/modules/recommendation', () => ({
  RecommendationScene: { HOME: 'home' },
  getRecommendations: jest.fn().mockResolvedValue({
    code: 200,
    data: { items: [{ id: 'dish-1' }], meta: { page: 1, totalPages: 1 } },
  }),
}));
jest.mock('@/api/modules/dish', () => ({
  getDishesByIds: jest.fn().mockResolvedValue({
    code: 200,
    data: {
      items: [{ id: 'dish-1', name: '宫保鸡丁', price: 15, images: [], averageRating: 4.5 }],
    },
  }),
}));

const mountHome = async (filterBarStub: any = true) => {
  const canteens = reactive({
    canteenList: [
      { id: 'canteen-1', name: '第一食堂' },
      { id: 'canteen-2', name: '第二食堂' },
    ],
    pagination: { page: 1, totalPages: 2 },
    loading: false,
    loadingMore: false,
    error: null,
    fetchCanteenList: jest.fn().mockResolvedValue(undefined),
    loadMoreCanteenList: jest.fn().mockResolvedValue(undefined),
  });
  (useCanteenStore as unknown as jest.Mock).mockReturnValue(canteens);
  (useDishesStore as unknown as jest.Mock).mockReturnValue(
    reactive({ dishes: [], loading: false, loadingMore: false, error: null, pagination: null })
  );
  (useUserStore as unknown as jest.Mock).mockReturnValue(
    reactive({
      sessionVersion: 1,
      isLoggedIn: true,
      userInfo: null,
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
    })
  );
  const wrapper = mount(IndexPage, {
    global: { stubs: { IndexSkeleton: true, FilterBar: filterBarStub, SearchBar: true } },
  });
  await flushPromises();
  return { wrapper, canteens };
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCanteenList as jest.Mock).mockReset();
});

describe('home discovery connections', () => {
  test('a failed recommendation append keeps existing dishes and retries the same page', async () => {
    (getRecommendations as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        requestId: 'recommendation',
        items: [{ id: 'dish-1' }],
        meta: { page: 1, totalPages: 2 },
      },
    });
    const { wrapper } = await mountHome();
    (getRecommendations as jest.Mock).mockRejectedValueOnce(new Error('temporary failure'));
    await (wrapper.vm as any).loadMoreRecommendations();
    await flushPromises();
    expect(wrapper.findAll('.dish-card')).toHaveLength(1);
    expect(wrapper.text()).toContain('加载更多菜品失败，请重试');
    (getRecommendations as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        requestId: 'recommendation',
        items: [{ id: 'dish-2' }],
        meta: { page: 2, totalPages: 2 },
      },
    });
    (getDishesByIds as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'dish-2', name: '米饭', price: 3, images: [], averageRating: 0 }] },
    });
    await wrapper
      .findAll('button')
      .find(button => button.text() === '重试加载更多')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.dish-card')).toHaveLength(2);
    expect(
      (getRecommendations as jest.Mock).mock.calls.map(([query]) => query.pagination.page)
    ).toEqual([1, 2, 2]);
    wrapper.unmount();
  });

  test('keeps more canteens reachable through a button and horizontal scroll', async () => {
    const { wrapper, canteens } = await mountHome();
    expect(wrapper.findAll('.canteen-entry')).toHaveLength(2);
    await wrapper.get('.canteen-more').trigger('click');
    expect(canteens.loadMoreCanteenList).toHaveBeenCalledTimes(1);
    await wrapper.get('.canteen-scroll').trigger('scrolltolower');
    expect(canteens.loadMoreCanteenList).toHaveBeenCalledTimes(2);
    canteens.loadingMore = true;
    await wrapper.get('.canteen-scroll').trigger('scrolltolower');
    expect(canteens.loadMoreCanteenList).toHaveBeenCalledTimes(2);
    canteens.loadingMore = false;
    canteens.pagination.page = 2;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.canteen-more').exists()).toBe(false);
    wrapper.unmount();
  });

  test('navigates once from a home dish and once from its canteen entry', async () => {
    const { wrapper } = await mountHome();
    await wrapper.get('.dish-card').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/dish/index?id=dish-1' });
    await wrapper.get('.canteen-entry').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledTimes(2);
    expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/canteen/index?id=canteen-1' });
    wrapper.unmount();
  });

  test('closes an open filter sheet before navigating back and when the page is hidden', async () => {
    const isOpen = ref(true);
    const closePanel = jest.fn(() => {
      isOpen.value = false;
    });
    const FilterSheet = defineComponent({
      setup(_, { expose }) {
        expose({ isOpen, closePanel });
        return () => null;
      },
    });
    const { wrapper } = await mountHome(FilterSheet);
    const onBack = (onBackPress as jest.Mock).mock.calls[0][0];
    expect(onBack()).toBe(true);
    expect(closePanel).toHaveBeenCalledTimes(1);
    expect(onBack()).toBe(false);
    isOpen.value = true;
    await wrapper.vm.$nextTick();
    (onHide as jest.Mock).mock.calls[0][0]();
    expect(isOpen.value).toBe(false);
    expect(closePanel).toHaveBeenCalledTimes(2);
    isOpen.value = true;
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="filter-back-helper"]').trigger('leave');
    expect(isOpen.value).toBe(false);
    expect(closePanel).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });
});

describe('canteen photo discovery', () => {
  test('always shows the canteen name with its real photo and an honest fallback after image failure', async () => {
    const name = '学生综合服务中心第三食堂';
    const wrapper = mount(CanteenEntry, {
      props: {
        canteen: { id: 'canteen-1', name, images: ['https://images.test/canteen-1.jpg'] } as any,
      },
      global: { stubs: { 'uni-icons': true } },
    });
    expect(wrapper.get('.canteen-entry__image').attributes('src')).toBe(
      'https://images.test/canteen-1.jpg'
    );
    expect(wrapper.get('.canteen-entry__name').text()).toBe(name);
    await wrapper.get('.canteen-entry__image').trigger('error');
    expect(wrapper.find('.canteen-entry__image').exists()).toBe(false);
    expect(wrapper.get('.canteen-entry__placeholder').text()).toContain('暂无照片');
    expect(wrapper.get('.canteen-entry__name').text()).toBe(name);
    await wrapper.setProps({
      canteen: {
        id: 'canteen-2',
        name: '第二食堂',
        images: ['https://images.test/canteen-2.jpg'],
      } as any,
    });
    expect(wrapper.get('.canteen-entry__image').attributes('src')).toBe(
      'https://images.test/canteen-2.jpg'
    );
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
    wrapper.unmount();
  });

  test('keeps the name visible without inventing a photo and retains the search destination', async () => {
    const canteen = mount(CanteenEntry, {
      props: { canteen: { id: 'canteen-1', name: '第一食堂', images: [] } as any },
      global: { stubs: { 'uni-icons': true } },
    });
    expect(canteen.find('.canteen-entry__image').exists()).toBe(false);
    expect(canteen.get('.canteen-entry__name').text()).toBe('第一食堂');
    expect(canteen.get('.canteen-entry__placeholder').text()).toContain('暂无照片');
    const search = mount(SearchBar, { global: { stubs: { 'uni-icons': true } } });
    await search.get('button').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/search/index' }));
    canteen.unmount();
    search.unmount();
  });
});

describe('canteen retry provenance', () => {
  const mountWithRealCanteenStore = async (totalPages: number) => {
    setActivePinia(createPinia());
    (useUserStore as unknown as jest.Mock).mockReturnValue(
      reactive({
        sessionVersion: 1,
        isLoggedIn: true,
        userInfo: null,
        fetchProfileAction: jest.fn().mockResolvedValue(undefined),
      })
    );
    const createCanteenStore = jest.requireActual(
      '@/store/modules/use-canteen-store'
    ).useCanteenStore;
    const canteens = createCanteenStore();
    canteens.canteenList = [{ id: 'cached-canteen', name: '第一食堂', images: [] }];
    canteens.pagination = { page: 1, pageSize: 9, total: totalPages * 9, totalPages };
    (useCanteenStore as unknown as jest.Mock).mockReturnValue(canteens);
    (useDishesStore as unknown as jest.Mock).mockReturnValue(
      reactive({ dishes: [], loading: false, loadingMore: false, error: null, pagination: null })
    );
    const wrapper = mount(IndexPage, {
      global: {
        stubs: { IndexSkeleton: true, FilterBar: true, SearchBar: true, 'uni-icons': true },
      },
    });
    await flushPromises();
    return { wrapper, canteens };
  };

  test.each([1, 2])(
    'retries a failed refresh from page one regardless of cached pagination (%s pages)',
    async totalPages => {
      const { wrapper, canteens } = await mountWithRealCanteenStore(totalPages);
      const loadMore = jest.spyOn(canteens, 'loadMoreCanteenList');
      (getCanteenList as jest.Mock).mockRejectedValueOnce(new Error('刷新食堂失败'));
      await (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
      await flushPromises();
      expect(canteens.canteenList[0].id).toBe('cached-canteen');
      expect(canteens.pagination.totalPages).toBe(totalPages);
      expect(canteens.error).toBe('刷新食堂失败');

      (getCanteenList as jest.Mock).mockResolvedValueOnce({
        code: 200,
        data: {
          items: [{ id: 'fresh-canteen', name: '新食堂', images: [] }],
          meta: { page: 1, pageSize: 9, total: 1, totalPages: 1 },
        },
      });
      await wrapper.get('[data-testid="canteen-retry"]').trigger('click');
      await flushPromises();
      expect(getCanteenList).toHaveBeenCalledTimes(2);
      expect(getCanteenList).toHaveBeenNthCalledWith(2, { page: 1, pageSize: 9 });
      expect(loadMore).not.toHaveBeenCalled();
      expect(canteens.error).toBeNull();
      expect(canteens.canteenList.map((item: any) => item.id)).toEqual(['fresh-canteen']);
      wrapper.unmount();
    }
  );

  test('retries a failed next page without replacing the previously loaded canteens', async () => {
    const { wrapper, canteens } = await mountWithRealCanteenStore(2);
    (getCanteenList as jest.Mock).mockRejectedValueOnce(new Error('分页食堂失败'));
    await wrapper.get('.canteen-more').trigger('click');
    await flushPromises();
    expect(canteens.error).toBe('分页食堂失败');
    (getCanteenList as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        items: [{ id: 'next-canteen', name: '下一页食堂', images: [] }],
        meta: { page: 2, pageSize: 9, total: 10, totalPages: 2 },
      },
    });
    await wrapper.get('[data-testid="canteen-retry"]').trigger('click');
    await flushPromises();
    expect(getCanteenList).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 9 });
    expect(canteens.canteenList.map((item: any) => item.id)).toEqual([
      'cached-canteen',
      'next-canteen',
    ]);
    expect(canteens.error).toBeNull();
    wrapper.unmount();
  });
});
