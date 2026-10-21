import { reactive } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import IndexPage from '@/pages/index/index.vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import { useUserStore } from '@/store/modules/use-user-store';
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
  getRecommendations: jest.fn(),
}));
jest.mock('@/api/modules/dish', () => ({ getDishes: jest.fn(), getDishesByIds: jest.fn() }));

const dish = (id: string, status: 'online' | 'offline' = 'online') => ({
  id,
  status,
  name: `菜品 ${id}`,
  price: 15,
  images: [],
  tags: [],
  averageRating: 4.5,
});
const recommendations = (ids: string[], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items: ids.map(id => ({ id })), requestId: 'home-session', meta: { page, totalPages } },
});
const details = (items: ReturnType<typeof dish>[]) => ({ code: 200, data: { items } });
const wrappers: ReturnType<typeof mount>[] = [];

function mountHome() {
  const user = reactive({
    sessionVersion: 1,
    isLoggedIn: true,
    userInfo: null,
    fetchProfileAction: jest.fn().mockResolvedValue(undefined),
  });
  const dishes = reactive({
    dishes: [],
    loading: false,
    loadingMore: false,
    error: null,
    pagination: null,
  });
  (useCanteenStore as unknown as jest.Mock).mockReturnValue(
    reactive({
      canteenList: [],
      pagination: null,
      loading: false,
      loadingMore: false,
      error: null,
      fetchCanteenList: jest.fn().mockResolvedValue(undefined),
    })
  );
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (useDishesStore as unknown as jest.Mock).mockReturnValue(dishes);
  const wrapper = mount(IndexPage, {
    global: { stubs: { IndexSkeleton: true, FilterBar: true, SearchBar: true } },
  });
  wrappers.push(wrapper);
  return { wrapper, dishes, user };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getRecommendations as jest.Mock).mockReset().mockResolvedValue(recommendations([]));
  (getDishesByIds as jest.Mock).mockReset();
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

test('real homepage cards omit dishes taken offline before hydration and preserve recommendation order', async () => {
  (getRecommendations as jest.Mock).mockResolvedValueOnce(
    recommendations(['second', 'removed', 'deleted', 'first'])
  );
  (getDishesByIds as jest.Mock).mockResolvedValueOnce(
    details([dish('first'), dish('removed', 'offline'), dish('second')])
  );
  const { wrapper } = mountHome();
  await flushPromises();
  expect(getDishesByIds).toHaveBeenCalledWith(['second', 'removed', 'deleted', 'first']);
  expect(wrapper.findAll('.dish-card').map(card => card.text())).toEqual([
    expect.stringContaining('菜品 second'),
    expect.stringContaining('菜品 first'),
  ]);
  expect(wrapper.text()).not.toContain('菜品 removed');
});

test('an entirely offline hydrated batch produces the normal homepage empty state', async () => {
  (getRecommendations as jest.Mock).mockResolvedValueOnce(recommendations(['removed']));
  (getDishesByIds as jest.Mock).mockResolvedValueOnce(details([dish('removed', 'offline')]));
  const { wrapper } = mountHome();
  await flushPromises();
  expect(wrapper.findAll('.dish-card')).toHaveLength(0);
  expect(wrapper.text()).toContain('暂无推荐菜品');
});

test('append retains current online cards and server pagination while excluding newly offline details', async () => {
  (getRecommendations as jest.Mock)
    .mockResolvedValueOnce(recommendations(['first', 'removed-first'], 1, 2))
    .mockResolvedValueOnce(recommendations(['second', 'removed-second'], 2, 2));
  (getDishesByIds as jest.Mock)
    .mockResolvedValueOnce(details([dish('removed-first', 'offline'), dish('first')]))
    .mockResolvedValueOnce(details([dish('removed-second', 'offline'), dish('second')]));
  const { wrapper, dishes } = mountHome();
  await flushPromises();
  await wrapper.get('.home-text-button').trigger('click');
  await flushPromises();
  expect(getRecommendations).toHaveBeenLastCalledWith(
    expect.objectContaining({
      requestId: 'home-session',
      pagination: { page: 2, pageSize: 10 },
    })
  );
  expect(wrapper.findAll('.dish-card').map(card => card.text())).toEqual([
    expect.stringContaining('菜品 first'),
    expect.stringContaining('菜品 second'),
  ]);
  expect(dishes.pagination).toEqual({ page: 2, totalPages: 2 });
  expect(wrapper.text()).not.toContain('菜品 removed');
  expect(wrapper.text()).toContain('没有更多了');
});

test('a superseded hydration cannot publish either online or offline cards after an account switch', async () => {
  let resolve!: (value: ReturnType<typeof details>) => void;
  (getRecommendations as jest.Mock).mockResolvedValueOnce(
    recommendations(['old-online', 'old-offline'])
  );
  (getDishesByIds as jest.Mock).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    })
  );
  const { wrapper, user } = mountHome();
  await flushPromises();
  user.sessionVersion++;
  await flushPromises();
  resolve(details([dish('old-online'), dish('old-offline', 'offline')]));
  await flushPromises();
  expect(getRecommendations).toHaveBeenCalledTimes(2);
  expect(wrapper.findAll('.dish-card')).toHaveLength(0);
  expect(wrapper.text()).toContain('暂无推荐菜品');
});
