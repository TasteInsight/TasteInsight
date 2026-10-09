import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { ref } from 'vue';
import DishPage from '@/pages/dish/index.vue';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { onBackPress, onHide } from '@dcloudio/uni-app';

jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn((callback: Function) => callback({ id: 'dish' })),
  onBackPress: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
let mockDetail: any;
jest.mock('@/pages/dish/composables/use-dish-detail', () => ({ useDishDetail: () => mockDetail }));
jest.mock('@/pages/dish/composables/use-report', () => ({
  useReport: () => ({
    isReportVisible: require('vue').ref(false),
    openReportModal: jest.fn(),
    closeReportModal: jest.fn(),
    submitReport: jest.fn(),
  }),
}));

const requests: any[] = [];
const wrappers: any[] = [];
const storage = new Map<string, any>();
const dish = (id = 'dish') => ({
  id,
  name: '番茄鸡蛋',
  price: 12,
  images: [],
  averageRating: 4.5,
  canteenName: '第一食堂',
  windowName: '家常菜',
  windowId: 'window',
  floorName: '二层',
  availableMealTime: ['lunch'],
  allergens: ['鸡蛋'],
  spicyLevel: 0,
});
const ok = (data: any, code = 200) => ({ statusCode: code, data: { code, data } });
const posts = () =>
  requests.filter(item => item.method === 'POST' && item.url.endsWith('/meal-plans'));
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: any) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  showToast: jest.fn(),
  navigateTo: jest.fn(),
  request: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  storage.clear();
  storage.set('token', 'A-token');
  storage.set('userInfo', JSON.stringify({ id: 'A', nickname: 'A' }));
  requests.length = 0;
  (global as any).uni = uniMock;
  uniMock.request.mockImplementation(options => {
    requests.push(options);
    const path = new URL(options.url).pathname;
    if (path === '/canteens') options.success(ok({ items: [], meta: { page: 1, totalPages: 1 } }));
    if (path.startsWith('/dishes/')) options.success(ok(dish(path.split('/').pop())));
    return { abort: jest.fn() };
  });
  mockDetail = {
    dish: ref(dish()),
    loading: ref(false),
    error: ref(''),
    fetchDishDetail: jest.fn(),
    subDishes: ref([]),
    parentDish: ref(null),
    reviews: ref([]),
    ownReview: ref(null), ownReviewLoading: ref(false), ownReviewLoaded: ref(true), ownReviewError: ref(''), fetchOwnReview: jest.fn(), deletingReview: ref(false),
    ratingSummary: ref({ average: 4.5, total: 3 }),
    reviewsLoading: ref(false),
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
  setActivePinia(createPinia());
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});
async function page() {
  const wrapper = shallowMount(DishPage, {
    global: { stubs: { PlanEditDialog: false, BottomReviewInput: false } },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

test('hides empty and failed photo areas while retaining dish information and accepting a new image', async () => {
  const wrapper = await page();
  expect(wrapper.find('.dish-photos').exists()).toBe(false);
  expect(wrapper.get('.dish-title').text()).toBe('番茄鸡蛋');
  mockDetail.dish.value = { ...dish(), images: ['https://images.test/first.jpg'] };
  await flushPromises();
  expect(wrapper.find('.dish-photos').exists()).toBe(true);
  await wrapper.get('.dish-photo').trigger('error');
  expect(wrapper.find('.dish-photos').exists()).toBe(false);
  mockDetail.dish.value = { ...dish(), images: ['https://images.test/replacement.jpg'] };
  await flushPromises();
  expect(wrapper.get('.dish-photo').attributes('src')).toBe('https://images.test/replacement.jpg');
});

test('the real action opens a preselected meal and double submission creates one plan through the store', async () => {
  const wrapper = await page();
  await wrapper.find('[aria-label="加入规划"]').trigger('click');
  const editor = wrapper.findComponent(PlanEditDialog);
  const form = (editor.vm as any).formData;
  expect(form.dishes).toEqual(['dish']);
  expect(form.startDate).toBe(form.endDate);
  expect(form.mealTime).toBe('lunch');
  const firstTap = editor.find('[data-testid="plan-save"]').trigger('tap');
  const secondTap = editor.find('[data-testid="plan-save"]').trigger('tap');
  await Promise.all([firstTap, secondTap]);
  await flushPromises();
  expect(posts()).toHaveLength(1);
  expect(posts()[0].data).toEqual({
    startDate: form.startDate,
    endDate: form.endDate,
    mealTime: 'lunch',
    dishes: ['dish'],
  });
  posts()[0].success(ok({ id: 'created', ...posts()[0].data }, 201));
  await flushPromises();
  expect(usePlanStore().allPlans[0].id).toBe('created');
  expect((wrapper.vm as any).isQuickPlanVisible).toBe(false);
  expect(uniMock.showToast).toHaveBeenCalledWith({ title: '已加入规划', icon: 'success' });
});

test('a failed save preserves edited date and meal for retry', async () => {
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.openQuickPlan();
  await flushPromises();
  const editor = wrapper.findComponent(PlanEditDialog).vm as any;
  editor.onStartDateChange({ detail: { value: '2099-11-06' } });
  editor.selectMealTime('dinner');
  const pending = vm.saveQuickPlan({ ...editor.formData });
  await flushPromises();
  expect(editor.formData).toMatchObject({
    startDate: '2099-11-06',
    endDate: '2099-11-06',
    mealTime: 'dinner',
  });
  posts()[0].success({ statusCode: 500, data: { code: 500 } });
  await expect(pending).resolves.toBe(false);
  expect(vm.isQuickPlanVisible).toBe(true);
  expect(vm.planSubmitting).toBe(false);
  expect(editor.formData).toMatchObject({
    startDate: '2099-11-06',
    endDate: '2099-11-06',
    mealTime: 'dinner',
    dishes: ['dish'],
  });
  const retry = vm.saveQuickPlan({ ...editor.formData });
  await flushPromises();
  posts()[1].success(ok({ id: 'retry', ...posts()[1].data }, 201));
  await expect(retry).resolves.toBe(true);
});

test.each(
  ['close', 'dish', 'account', 'hide', 'dispose'].flatMap(change =>
    ['success', 'failure'].map(outcome => [change, outcome])
  )
)(
  'late completion after %s (%s) does not affect the next dialog or account',
  async (change, outcome) => {
    const wrapper = await page();
    const vm = wrapper.vm as any;
    const body = {
      startDate: '2099-10-03',
      endDate: '2099-10-03',
      mealTime: 'lunch',
      dishes: ['dish'],
    };
    vm.openQuickPlan();
    const old = vm.saveQuickPlan(body);
    await flushPromises();
    const oldRequest = posts()[0];
    if (change === 'dispose') wrapper.unmount();
    else {
      if (change === 'close') vm.closeQuickPlan();
      if (change === 'hide') (onHide as jest.Mock).mock.calls[0][0]();
      if (change === 'dish') {
        vm.dishId = 'other';
        mockDetail.dish.value = dish('other');
      }
      if (change === 'account') {
        useUserStore().logoutAction();
        useUserStore().token = 'B-token';
        useUserStore().userInfo = { id: 'B', nickname: 'B' } as any;
      }
      expect(vm.isQuickPlanVisible).toBe(false);
      vm.openQuickPlan();
    }
    const current =
      change === 'dispose'
        ? null
        : vm.saveQuickPlan({
            ...body,
            startDate: '2099-10-04',
            endDate: '2099-10-04',
            dishes: [mockDetail.dish.value.id],
          });
    await flushPromises();
    oldRequest.success(
      outcome === 'success'
        ? ok({ id: 'old', ...body }, 201)
        : { statusCode: 500, data: { code: 500 } }
    );
    await expect(old).resolves.toBe(false);
    expect(uniMock.showToast).not.toHaveBeenCalled();
    if (current) {
      expect(vm.planSubmitting).toBe(true);
      expect(vm.isQuickPlanVisible).toBe(true);
      posts()[1].success(ok({ id: 'current', ...posts()[1].data }, 201));
      await current;
      expect(uniMock.showToast).toHaveBeenCalledTimes(1);
    }
    if (change === 'account')
      expect(usePlanStore().allPlans.map(plan => plan.id)).toEqual(['current']);
    else if (outcome === 'success')
      expect(usePlanStore().allPlans.some(plan => plan.id === 'old')).toBe(true);
  }
);

test('dish information expands without hiding window navigation or implying unknown allergens are safe', async () => {
  const wrapper = await page();
  expect(wrapper.find('.decision-facts').exists()).toBe(false);
  await wrapper.get('.dish-more-toggle').trigger('click');
  expect(wrapper.find('.decision-facts').text()).toContain('鸡蛋');
  expect(wrapper.find('.decision-facts').text()).toContain('午餐');
  expect(wrapper.find('.dish-location').text()).toContain('二层');
  await wrapper.find('[data-testid="dish-window"]').trigger('click');
  expect(uniMock.navigateTo).toHaveBeenCalledWith({ url: '/pages/window/index?id=window' });
  mockDetail.dish.value = { ...dish(), allergens: [], availableMealTime: [], windowId: undefined };
  await flushPromises();
  expect(wrapper.find('.decision-facts').text()).toContain('暂未提供');
  expect(wrapper.find('.decision-facts').text()).toContain('供应餐时暂未提供');
  expect(wrapper.find('[data-testid="dish-window"]').exists()).toBe(false);
  expect(wrapper.find('.rating-overview').text()).toContain('3 条评价');
});

test('native back closes the quick plan before navigating and review/favorite actions remain available', async () => {
  const wrapper = await page();
  const vm = wrapper.vm as any;
  await wrapper.find('[aria-label="收藏此菜品"]').trigger('click');
  expect(mockDetail.toggleFavorite).toHaveBeenCalledTimes(1);
  vm.openQuickPlan();
  await flushPromises();
  expect((onBackPress as jest.Mock).mock.calls[0][0]()).toBe(true);
  await flushPromises();
  expect(vm.isQuickPlanVisible).toBe(false);
  expect(wrapper.get('.dish-action-primary').attributes('aria-label')).toBe('写评价');
  await wrapper.find('.dish-action-primary').trigger('click');
  expect(vm.isReviewFormVisible).toBe(true);
  expect(vm.isQuickPlanVisible).toBe(false);
});
