import { createPinia, setActivePinia } from 'pinia';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { useUserStore } from '@/store/modules/use-user-store';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import { useAddDish } from '@/pages/add-dish/composables/use-add-dish';
import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import { uploadImage } from '@/api/modules/upload';
import IndexPage from '@/pages/index/index.vue';
import { useReviewForm } from '@/pages/dish/composables/use-review';
import { usePersonal } from '@/pages/settings/composables/use-personal';
import { useMenuPlanning } from '@/pages/planning/composables/use-menu-planning';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import ReviewForm from '@/pages/dish/components/ReviewForm.vue';

jest.mock('@dcloudio/uni-app', () => ({ onPullDownRefresh: jest.fn(), onReachBottom: jest.fn(), onShow: jest.fn() }));

const storage = new Map<string, any>();
const requests: any[] = [];
const uploads: any[] = [];
const wrappers: any[] = [];
let autoCanteens = false;
const profile = (id: string) => ({ id, openId: `${id}-openid`, nickname: id });
const success = (data: any) => ({ statusCode: 200, data: { code: 200, data } });
const meta = { page: 1, pageSize: 10, total: 1, totalPages: 1 };
const matching = (path: string) => requests.filter(item => new URL(item.url).pathname === path);
const latest = (path: string) => matching(path).slice(-1)[0];
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
  setStorageSync: (key: string, value: any) => storage.set(key, JSON.parse(JSON.stringify(value))),
  removeStorageSync: (key: string) => storage.delete(key),
  request: jest.fn(), uploadFile: jest.fn(), showToast: jest.fn(), navigateBack: jest.fn(),
  reLaunch: jest.fn(), navigateTo: jest.fn(), stopPullDownRefresh: jest.fn(),
  chooseImage: jest.fn(), showLoading: jest.fn(), hideLoading: jest.fn(),
  showModal: jest.fn(),
  getSystemInfoSync: () => ({ windowWidth: 375 }), hideTabBar: jest.fn(), showTabBar: jest.fn(),
};
(global as any).uni = uniMock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  storage.clear();
  storage.set('token', 'A-access');
  storage.set('refreshToken', 'A-refresh');
  storage.set('userInfo', JSON.stringify(profile('A')));
  requests.length = 0;
  uploads.length = 0;
  autoCanteens = false;
  setActivePinia(createPinia());
  uniMock.request.mockImplementation(options => {
    requests.push(options);
    const path = new URL(options.url).pathname;
    if (path === '/auth/wechat/login') {
      const id = options.data.code;
      options.success(success({ token: { accessToken: `${id}-access`, refreshToken: `${id}-refresh` }, user: profile(id) }));
    } else if (path === '/user/profile') {
      const id = options.header.Authorization.split(' ')[1].split('-')[0];
      options.success(success(profile(id)));
    } else if (autoCanteens && path === '/canteens') {
      options.success(success({ items: [], meta }));
    }
    return { abort: jest.fn() };
  });
  uniMock.uploadFile.mockImplementation(options => {
    uploads.push(options);
    return { abort: jest.fn() };
  });
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

function fillDraft(draft: ReturnType<typeof useAddDish>, name: string, images: string[] = []) {
  Object.assign(draft.formData, {
    name, images, price: 10, canteenName: '食堂', windowName: '窗口', availableMealTime: ['lunch'],
  });
}

describe('real multipart and draft request chain', () => {
  test.each(['http://tmp/selected-dish.jpg', '/tmp/selected-dish.jpg'])('selected temporary image %s is uploaded before the dish submission', async path => {
    uniMock.chooseImage.mockImplementation(options => options.success({ tempFilePaths: [path] }));
    const draft = useAddDish();
    fillDraft(draft, 'selected image');
    draft.chooseImages();
    const pending = draft.submitForm();
    await flushPromises();

    expect(uploads).toHaveLength(1);
    expect(uploads[0].filePath).toBe(path);
    expect(matching('/dishes/upload')).toHaveLength(0);
    uploads[0].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/selected-dish.jpg' } }) });
    await flushPromises();
    expect(latest('/dishes/upload').data.images).toEqual(['https://images.test/selected-dish.jpg']);
    latest('/dishes/upload').success(success({ id: 'dish-upload' }));
    await expect(pending).resolves.toBe(true);
    expect(draft.formData.images).toEqual([path]);
  });

  test('a failed temporary upload keeps the selection available for retry', async () => {
    const path = 'http://tmp/selected-dish.jpg';
    uniMock.chooseImage.mockImplementation(options => options.success({ tempFilePaths: [path] }));
    const draft = useAddDish();
    fillDraft(draft, 'selected image');
    draft.chooseImages();
    const first = draft.submitForm();
    await flushPromises();
    expect(uploads).toHaveLength(1);
    uploads[0].fail(new Error('image unavailable'));
    await expect(first).resolves.toBe(false);
    expect(draft.formData.images).toEqual([path]);
    expect(matching('/dishes/upload')).toHaveLength(0);

    const retry = draft.submitForm();
    expect(uploads).toHaveLength(2);
    expect(uploads[1].filePath).toBe(path);
    uploads[1].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/retried.jpg' } }) });
    await flushPromises();
    expect(latest('/dishes/upload').data.images).toEqual(['https://images.test/retried.jpg']);
    latest('/dishes/upload').success(success({ id: 'dish-upload' }));
    await expect(retry).resolves.toBe(true);
  });

  test('late native draft image selection cannot append files to the new login draft', async () => {
    let selected!: (data: any) => void;
    uniMock.chooseImage.mockImplementation(options => { selected = options.success; });
    const draft = useAddDish();
    draft.chooseImages();
    await useUserStore().loginAction('B');
    selected({ tempFilePaths: ['/tmp/A.jpg'] });
    expect(draft.formData.images).toEqual([]);
  });
  test.each(['success', 'failure'])('an old multipart %s cannot settle as the new account upload', async outcome => {
    const pending = uploadImage('/tmp/A.jpg');
    const rejected = expect(pending).rejects.toThrow();
    expect(uploads[0].header.Authorization).toBe('Bearer A-access');
    await useUserStore().loginAction('B');
    if (outcome === 'success') uploads[0].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/A.jpg' } }) });
    else uploads[0].fail(new Error('old upload failed'));
    await rejected;
    expect(useUserStore().token).toBe('B-access');
  });

  test.each(['success', 'failure'])('an old draft upload %s cannot submit or finish the new draft', async outcome => {
    const draft = useAddDish();
    fillDraft(draft, 'A draft', ['/tmp/A.jpg']);
    const old = draft.submitForm();
    await flushPromises();
    await useUserStore().loginAction('B');
    fillDraft(draft, 'B draft');
    const current = draft.submitForm();
    await flushPromises();
    if (outcome === 'success') uploads[0].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/A.jpg' } }) });
    else uploads[0].fail(new Error('old upload failed'));
    await expect(old).resolves.toBe(false);
    expect(draft.submitting.value).toBe(true);
    expect(draft.error.value).toBe('');
    expect(matching('/dishes/upload')).toHaveLength(1);
    expect(latest('/dishes/upload')).toMatchObject({
      header: { Authorization: 'Bearer B-access' }, data: { name: 'B draft', images: [] },
    });
    expect(uniMock.showToast).not.toHaveBeenCalled();
    latest('/dishes/upload').success(success({ id: 'B-upload' }));
    await expect(current).resolves.toBe(true);
  });

  test('the upload command snapshots form data and delayed navigation stays in its login', async () => {
    const draft = useAddDish();
    fillDraft(draft, 'A original', ['/tmp/A.jpg']);
    const pending = draft.submitForm();
    await flushPromises();
    draft.formData.name = 'edited while uploading';
    uploads[0].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/A.jpg' } }) });
    await flushPromises();
    expect(latest('/dishes/upload').data.name).toBe('A original');
    latest('/dishes/upload').success(success({ id: 'A-upload' }));
    await pending;
    await useUserStore().loginAction('B');
    jest.advanceTimersByTime(1500);
    expect(uniMock.navigateBack).not.toHaveBeenCalled();
  });
});

describe('real shared stores and chained consumers', () => {
  test.each([false, true])('a late plan fetch cannot affect B before/after its completion: %s', async finishBFirst => {
    const store = usePlanStore();
    const old = store.fetchPlans().catch(() => undefined);
    await flushPromises();
    const oldRequest = latest('/meal-plans');
    await useUserStore().loginAction('B');
    const current = store.fetchPlans();
    await flushPromises();
    const finish = async () => {
      latest('/meal-plans').success(success({ items: [{ id: 'B-plan', dishes: [], startDate: '2026-10-03', endDate: '2026-10-03', mealTime: 'lunch' }] }));
      await current;
    };
    if (finishBFirst) await finish();
    oldRequest.success(success({ items: [] }));
    await old;
    expect(store.error).toBeNull();
    expect(store.loading).toBe(!finishBFirst);
    if (!finishBFirst) await finish();
    expect(store.allPlans.map(plan => plan.id)).toEqual(['B-plan']);
  });

  test('a resolved old create cannot hydrate its dishes under the new login', async () => {
    const store = usePlanStore();
    const old = store.createPlan({ startDate: '2026-10-03', endDate: '2026-10-03', mealTime: 'lunch', dishes: ['A-dish'] }).catch(() => undefined);
    await flushPromises();
    latest('/meal-plans').success(success({ id: 'A-plan', dishes: ['A-dish'], startDate: '2026-10-03', endDate: '2026-10-03', mealTime: 'lunch' }));
    await useUserStore().loginAction('B');
    await flushPromises();
    expect(matching('/dishes/A-dish')).toHaveLength(0);
    await old;
    expect(store.allPlans).toEqual([]);
  });

  test('identity changes clear private plan caches while preserving public canteen caches', async () => {
    const plans = usePlanStore();
    const canteens = useCanteenStore();
    plans.allPlans = [{ id: 'A-plan', dishes: [] }] as any;
    plans.selectedPlan = { id: 'A-plan' } as any;
    canteens.canteenList = [{ id: 'A-canteen' }] as any;
    await useUserStore().loginAction('B');
    expect(plans.allPlans).toEqual([]);
    expect(plans.selectedPlan).toBeNull();
    expect(canteens.canteenList).toEqual([{ id: 'A-canteen' }]);
  });

  test('a late canteen detail cannot report an error or end B loading', async () => {
    const page = useCanteenData();
    const old = page.init('A');
    await flushPromises();
    await useUserStore().loginAction('B');
    const current = page.init('B');
    await flushPromises();
    latest('/canteens/A').success(success({ id: 'A' }));
    await old;
    expect(page.error.value).toBeNull();
    expect(page.loading.value).toBe(true);
    latest('/canteens/B').success(success({ id: 'B' }));
    await flushPromises();
    latest('/canteens/B/windows').success(success({ items: [], meta }));
    await flushPromises();
    latest('/dishes').success(success({ items: [], meta }));
    await current;
    expect(page.canteenInfo.value!.id).toBe('B');
  });

  test.each(['canteen', 'window'])('a stale %s initializer does not start its next network stage', async kind => {
    const consumer = kind === 'canteen' ? useCanteenData() : useWindowData();
    const pending = consumer.init('A');
    await flushPromises();
    await useUserStore().loginAction('B');
    latest(kind === 'canteen' ? '/canteens/A' : '/windows/A').success(success({ id: 'A' }));
    await flushPromises();
    expect(matching('/canteens/A/windows')).toHaveLength(0);
    expect(matching('/windows/A/dishes')).toHaveLength(0);
    expect(matching('/dishes')).toHaveLength(0);
    await pending;
  });

  test('an old modal confirmation cannot start deletion under the new login', async () => {
    let confirm!: (data: any) => void;
    uniMock.showModal.mockImplementation(options => { confirm = options.success; });
    const planning = useMenuPlanning();
    const old = planning.deletePlan('A-plan');
    await useUserStore().loginAction('B');
    confirm({ confirm: true });
    await old;
    expect(matching('/meal-plans/A-plan')).toHaveLength(0);
  });

  test('a stale save cannot close or finish a B planning submission', async () => {
    const planning = useMenuPlanning();
    const body = { startDate: '2026-10-03', endDate: '2026-10-03', mealTime: 'lunch', dishes: [] } as any;
    planning.createNewPlan();
    const old = planning.submitCreate(body);
    await flushPromises();
    const oldRequest = latest('/meal-plans');
    await useUserStore().loginAction('B');
    planning.createNewPlan();
    const current = planning.submitCreate(body);
    await flushPromises();
    oldRequest.success(success({ id: 'A-plan', ...body }));
    await old;
    expect(planning.submitting.value).toBe(true);
    expect(planning.showCreateDialog.value).toBe(true);
    latest('/meal-plans').success(success({ id: 'B-plan', ...body }));
    await current;
    expect(planning.submitting.value).toBe(false);
  });
});

describe('actual review and avatar upload consumers', () => {
  test('review drafts restore only for their authenticated owner and can be cleared independently', async () => {
    const form = useReviewForm();
    form.rating.value = 4;
    form.content.value = 'A private draft';
    form.setRemoteImages(['https://images.test/A-review.jpg']);
    await form.saveReviewState('dish');

    const reopened = useReviewForm();
    expect(reopened.hasSavedReviewState('dish')).toBe(true);
    expect(reopened.loadReviewState('dish')).toBe(true);
    expect(reopened.content.value).toBe('A private draft');
    expect(reopened.images.value).toEqual([{ source: 'remote', path: 'https://images.test/A-review.jpg' }]);

    await useUserStore().loginAction('B');
    expect(form.content.value).toBe('');
    expect(form.hasSavedReviewState('dish')).toBe(false);
    expect(form.loadReviewState('dish')).toBe(false);
    expect(form.images.value).toEqual([]);
    form.clearReviewState('dish');
    form.rating.value = 5;
    form.content.value = 'B private draft';
    await form.saveReviewState('dish');

    await useUserStore().loginAction('A');
    expect(form.loadReviewState('dish')).toBe(true);
    expect(form.content.value).toBe('A private draft');
    expect(form.images.value).toEqual([{ source: 'remote', path: 'https://images.test/A-review.jpg' }]);
    form.clearReviewState('dish');
    expect(form.hasSavedReviewState('dish')).toBe(false);

    await useUserStore().loginAction('B');
    expect(form.loadReviewState('dish')).toBe(true);
    expect(form.content.value).toBe('B private draft');
  });

  test('legacy and unauthenticated review drafts are not adopted by a later login', async () => {
    storage.set('review_state_dish', { rating: 5, content: 'unowned draft', images: ['https://images.test/legacy.jpg'], timestamp: Date.now() });
    const form = useReviewForm();
    expect(form.hasSavedReviewState('dish')).toBe(false);
    expect(form.loadReviewState('dish')).toBe(false);
    form.clearReviewState('dish');
    expect(storage.has('review_state_dish')).toBe(true);

    useUserStore().logoutAction();
    form.content.value = 'anonymous draft';
    await form.saveReviewState('anonymous-dish');
    expect(form.hasSavedReviewState('anonymous-dish')).toBe(false);
    expect(form.loadReviewState('anonymous-dish')).toBe(false);
    useUserStore().token = 'B-access';
    await form.saveReviewState('identity-pending-dish');
    expect([...storage.keys()].filter(key => key.startsWith('review_state'))).toEqual(['review_state_dish']);
    useUserStore().userInfo = profile('B') as any;
    expect(form.content.value).toBe('');
    expect(form.hasSavedReviewState('anonymous-dish')).toBe(false);
    expect(form.loadReviewState('dish')).toBe(false);
  });

  test('same-owner review drafts survive relogin and expire after 24 hours', async () => {
    const savedAt = Date.now();
    const form = useReviewForm();
    form.rating.value = 4;
    form.content.value = 'saved review';
    form.flavorRatings.value = { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 };
    await form.saveReviewState('dish');
    await useUserStore().loginAction('A');
    jest.setSystemTime(savedAt + 24 * 60 * 60 * 1000 - 1);
    expect(form.hasSavedReviewState('dish')).toBe(true);
    expect(form.loadReviewState('dish')).toBe(true);
    expect(form.content.value).toBe('saved review');
    expect(form.flavorRatings.value).toEqual({ spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 });
    form.resetForm();
    jest.setSystemTime(savedAt + 24 * 60 * 60 * 1000);
    expect(form.hasSavedReviewState('dish')).toBe(false);
    expect(form.loadReviewState('dish')).toBe(false);
    expect(form.content.value).toBe('');
  });

  test('the actual review picker cannot begin a B upload for an A selection', async () => {
    let selected!: (data: any) => void;
    uniMock.chooseImage.mockImplementation(options => { selected = options.success; });
    const wrapper = shallowMount(ReviewForm, { props: { dishId: 'dish', dishName: '菜' } });
    wrappers.push(wrapper);
    (wrapper.vm as any).handleChooseImage();
    await useUserStore().loginAction('B');
    selected({ tempFilePaths: ['/tmp/A.jpg'] });
    expect(uploads).toHaveLength(0);
  });
  test('an already resolved old review image cannot be included in a B review', async () => {
    const form = useReviewForm();
    form.rating.value = 4;
    form.addImages(['/tmp/A.jpg']);
    const old = form.handleSubmit('dish');
    uploads[0].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/A.jpg' } }) });
    await useUserStore().loginAction('B');
    await old;
    expect(form.images.value).toEqual([]);
    form.rating.value = 5;
    const current = form.handleSubmit('dish');
    await flushPromises();
    expect(latest('/reviews').data.images).toEqual([]);
    expect(latest('/reviews').header.Authorization).toBe('Bearer B-access');
    latest('/reviews').success(success({ id: 'B-review' }));
    await current;
  });

  test('an old avatar upload cannot report failure or finish B uploading', async () => {
    uniMock.chooseImage.mockImplementation(options => options.success({ tempFilePaths: ['/tmp/avatar.jpg'] }));
    const personal = usePersonal();
    const old = personal.chooseAvatar().catch(() => undefined);
    await useUserStore().loginAction('B');
    const current = personal.chooseAvatar();
    uploads[0].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/A.jpg' } }) });
    await old;
    expect(personal.uploading.value).toBe(true);
    expect(uniMock.showToast).not.toHaveBeenCalled();
    uploads[1].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/B.jpg' } }) });
    await current;
    expect(personal.form.avatar).toBe('https://images.test/B.jpg');
  });

  test('late native image selection cannot start an upload with a new login', async () => {
    let selected!: (data: any) => void;
    uniMock.chooseImage.mockImplementation(options => { selected = options.success; });
    const personal = usePersonal();
    const old = personal.chooseAvatar();
    await useUserStore().loginAction('B');
    selected({ tempFilePaths: ['/tmp/A.jpg'] });
    expect(uploads).toHaveLength(0);
    await old;
  });

  test('a late real crop callback cannot start an upload with a new login', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const personal = usePersonal();
    process.env.NODE_ENV = originalEnv;
    let cropped!: (data: any) => void;
    uniMock.chooseImage.mockImplementation(options => options.success({ tempFilePaths: ['/tmp/A.jpg'] }));
    uniMock.navigateTo.mockImplementation(options => options.success({ eventChannel: {
      emit: jest.fn(), on: (_event: string, callback: any) => { cropped = callback; },
    } }));
    const old = personal.chooseAvatar();
    await useUserStore().loginAction('B');
    cropped({ tempFilePath: '/tmp/A-cropped.jpg' });
    expect(uploads).toHaveLength(0);
    await old;
  });
});

describe('real home recommendation writer', () => {
  async function mountReadyHome() {
    autoCanteens = true;
    const wrapper = shallowMount(IndexPage, { global: { stubs: { swiper: true, 'swiper-item': true, IndexSkeleton: true, SearchBar: true, FilterBar: true, RecommendItem: true, CanteenList: true } } });
    wrappers.push(wrapper);
    await flushPromises();
    latest('/recommend').success(success({ requestId: 'cached-recommendation', items: [{ id: 'cached-dish' }], meta }));
    await flushPromises();
    latest('/dishes/by-ids').success(success({ items: [{ id: 'cached-dish', name: 'cached dish' }], meta }));
    await flushPromises();
    return wrapper;
  }

  function holdProfileRequests() {
    const transport = uniMock.request.getMockImplementation()!;
    uniMock.request.mockImplementation(options => {
      if (new URL(options.url).pathname === '/user/profile') {
        requests.push(options);
        return { abort: jest.fn() };
      }
      return transport(options);
    });
  }

  test.each(['success', 'failure'])('a superseded home profile %s cannot commit or restart recommendations', async outcome => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    holdProfileRequests();
    const previous = vm.loadHomeForSession();
    await flushPromises();
    const oldProfile = latest('/user/profile');
    const current = vm.handleFilterChange({ tag: ['current'] });
    await flushPromises();
    latest('/recommend').success({ statusCode: 500, data: { code: 500, message: 'current failed' } });
    await current;
    const error = vm.recommendError;
    const count = matching('/recommend').length;
    uniMock.showToast.mockClear();
    oldProfile.success(outcome === 'success'
      ? success({ ...profile('A'), preferences: { favoriteIngredients: ['stale'] } })
      : { statusCode: 500, data: { code: 500, message: 'old profile failed' } });
    await previous;
    await flushPromises();
    expect(useUserStore().userInfo?.preferences).toBeUndefined();
    expect(JSON.parse(storage.get('userInfo')).preferences).toBeUndefined();
    expect(matching('/recommend')).toHaveLength(count);
    expect(vm.recommendError).toBe(error);
    expect(useDishesStore().loading).toBe(false);
    expect(uniMock.showToast).not.toHaveBeenCalled();
  });

  test('an old home canteen result cannot replace the latest committed list', async () => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    autoCanteens = false;
    const previous = vm.loadHomeForSession(true);
    await flushPromises();
    const oldCanteens = latest('/canteens');
    const current = vm.loadHomeForSession(true);
    await flushPromises();
    latest('/canteens').success(success({ items: [{ id: 'new-canteen', name: 'new' }], meta }));
    await flushPromises();
    latest('/recommend').success(success({ requestId: 'current', items: [], meta }));
    await current;
    oldCanteens.success(success({ items: [{ id: 'old-canteen', name: 'old' }], meta }));
    await previous;
    expect(useCanteenStore().canteenList.map(item => item.id)).toEqual(['new-canteen']);
    expect(useCanteenStore().loading).toBe(false);
  });

  test('a current profile refresh is consumed by its home run without superseding itself', async () => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    holdProfileRequests();
    const count = matching('/recommend').length;
    const current = vm.loadHomeForSession();
    await flushPromises();
    latest('/user/profile').success(success({ ...profile('A'), preferences: { favoriteIngredients: ['fresh'] } }));
    await flushPromises();
    expect(matching('/recommend')).toHaveLength(count + 1);
    latest('/recommend').success(success({ requestId: 'fresh-profile', items: [], meta }));
    expect(await current).toBe('success');
    expect(vm.currentRequestId).toBe('fresh-profile');
    expect(useUserStore().userInfo?.preferences?.favoriteIngredients).toEqual(['fresh']);
    expect(vm.isInitialLoading).toBe(false);
  });

  test('home preparation preserves a newer local profile update while its fetch is pending', async () => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    holdProfileRequests();
    const current = vm.loadHomeForSession();
    await flushPromises();
    useUserStore().updateLocalUserInfo({ preferences: { favoriteIngredients: ['current'] } } as any);
    await flushPromises();
    latest('/user/profile').success(success({ ...profile('A'), preferences: { favoriteIngredients: ['old'] } }));
    await flushPromises();
    expect(useUserStore().userInfo?.preferences?.favoriteIngredients).toEqual(['current']);
    latest('/recommend').success(success({ requestId: 'local-profile', items: [], meta }));
    expect(await current).toBe('success');
  });

  test('a superseded canteen request cannot stop a newer preparation loading indicator', async () => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    autoCanteens = false;
    const previous = vm.loadHomeForSession(true);
    await flushPromises();
    const oldCanteens = latest('/canteens');
    const current = vm.loadHomeForSession(true);
    await flushPromises();
    const newCanteens = latest('/canteens');
    oldCanteens.success(success({ items: [{ id: 'old-canteen' }], meta }));
    await previous;
    expect(useCanteenStore().loading).toBe(true);
    expect(useCanteenStore().canteenList).toEqual([]);
    newCanteens.success(success({ items: [{ id: 'new-canteen' }], meta }));
    await flushPromises();
    latest('/recommend').success(success({ requestId: 'new-canteens', items: [], meta }));
    await current;
    expect(useCanteenStore().loading).toBe(false);
  });

  test.each([
    ['filter', 'recommendation'], ['filter', 'details'],
    ['home', 'recommendation'], ['home', 'details'],
    ['preferences', 'recommendation'], ['preferences', 'details'],
  ])('a stale same-session %s %s result cannot clear the latest filter error', async (source, phase) => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    let previous: Promise<unknown> | undefined;
    if (source === 'filter') previous = vm.handleFilterChange({ tag: ['previous'] });
    else if (source === 'home') previous = vm.loadHomeForSession();
    else useUserStore().userInfo!.preferences = { favoriteIngredients: ['previous'] } as any;
    await flushPromises();
    const oldRecommendation = latest('/recommend');
    if (phase === 'details') {
      oldRecommendation.success(success({ requestId: 'previous-recommendation', items: [{ id: 'previous-dish' }], meta }));
      await flushPromises();
    }
    const oldStage = phase === 'details' ? latest('/dishes/by-ids') : oldRecommendation;
    const current = vm.handleFilterChange({ tag: ['current'] });
    await flushPromises();
    latest('/recommend').success({ statusCode: 500, data: { code: 500, message: 'filter failed' } });
    await current;
    const error = vm.recommendError;
    expect(error).toBeTruthy();

    oldStage.success(success(phase === 'details'
      ? { items: [{ id: 'previous-dish' }], meta }
      : { requestId: 'previous-recommendation', items: [{ id: 'previous-dish' }], meta }));
    await previous;
    await flushPromises();
    expect(vm.recommendError).toBe(error);
    expect(vm.currentFilter).toEqual({ tag: ['current'] });
    expect(useDishesStore().dishes.map(dish => dish.id)).toEqual(['cached-dish']);
    expect(useDishesStore().loading).toBe(false);
    expect(vm.isInitialLoading).toBe(false);
    expect(wrapper.text()).toContain(error);
    expect(wrapper.findComponent({ name: 'RecommendItem' }).exists()).toBe(false);
  });

  test.each(['success', 'failure'])('a superseded home preparation %s cannot start or settle the current recommendation run', async outcome => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    autoCanteens = false;
    const previous = vm.loadHomeForSession(true);
    await flushPromises();
    const oldCanteens = latest('/canteens');
    const current = vm.handleFilterChange({ tag: ['current'] });
    await flushPromises();
    latest('/recommend').success({ statusCode: 500, data: { code: 500, message: 'filter failed' } });
    await current;
    const error = vm.recommendError;
    const recommendationCount = matching('/recommend').length;
    if (outcome === 'success') oldCanteens.success(success({ items: [], meta }));
    else oldCanteens.success({ statusCode: 500, data: { code: 500, message: 'canteens failed' } });
    await flushPromises();
    expect(matching('/recommend')).toHaveLength(recommendationCount);
    await previous;
    expect(vm.recommendError).toBe(error);
    expect(useDishesStore().loading).toBe(false);
    expect(vm.isInitialLoading).toBe(false);
  });

  test.each(['success', 'failure'])('a superseded same-session %s cannot end the current filter loading', async outcome => {
    const wrapper = await mountReadyHome();
    const vm = wrapper.vm as any;
    const previous = vm.handleFilterChange({ tag: ['previous'] });
    await flushPromises();
    const oldRequest = latest('/recommend');
    const current = vm.handleFilterChange({ tag: ['current'] });
    await flushPromises();
    if (outcome === 'success') oldRequest.success(success({ requestId: 'previous-recommendation', items: [], meta }));
    else oldRequest.success({ statusCode: 500, data: { code: 500, message: 'previous filter failed' } });
    await previous;
    expect(useDishesStore().loading).toBe(true);
    expect(vm.recommendError).toBeNull();
    expect(useDishesStore().dishes.map(dish => dish.id)).toEqual(['cached-dish']);

    latest('/recommend').success(success({ requestId: 'current-recommendation', items: [{ id: 'current-dish' }], meta }));
    await flushPromises();
    latest('/dishes/by-ids').success(success({ items: [{ id: 'current-dish' }], meta }));
    await current;
    expect(useDishesStore().loading).toBe(false);
    expect(vm.recommendError).toBeNull();
    expect(useDishesStore().dishes.map(dish => dish.id)).toEqual(['current-dish']);
    expect(vm.currentRequestId).toBe('current-recommendation');
  });

  test('a superseded pull-down refresh does not report a result after the latest filter succeeds', async () => {
    const wrapper = await mountReadyHome();
    const previous = (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    const oldRequest = latest('/recommend');
    const current = (wrapper.vm as any).handleFilterChange({ tag: ['current'] });
    await flushPromises();
    latest('/recommend').success(success({ requestId: 'current-recommendation', items: [], meta }));
    await current;
    uniMock.showToast.mockClear();
    oldRequest.success(success({ requestId: 'previous-recommendation', items: [], meta }));
    await previous;
    expect(uniMock.showToast).not.toHaveBeenCalled();
    expect((wrapper.vm as any).currentRequestId).toBe('current-recommendation');
  });

  test('a cached home completes B initialization when A initial public data is still pending', async () => {
    const wrapper = shallowMount(IndexPage, { global: { stubs: { swiper: true, 'swiper-item': true, IndexSkeleton: true, SearchBar: true, FilterBar: true, RecommendItem: true, CanteenList: true } } });
    wrappers.push(wrapper);
    await flushPromises();
    const oldCanteens = latest('/canteens');
    await useUserStore().loginAction('B');
    (onShow as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(latest('/canteens').header.Authorization).toBe('Bearer B-access');
    latest('/canteens').success(success({ items: [{ id: 'public-canteen', name: '食堂', images: [] }], meta }));
    await flushPromises();
    latest('/recommend').success(success({ requestId: 'B-recommendation', items: [], meta }));
    await flushPromises();
    oldCanteens.success(success({ items: [], meta }));
    await flushPromises();
    expect((wrapper.vm as any).isInitialLoading).toBe(false);
    expect(wrapper.findComponent({ name: 'IndexSkeleton' }).exists()).toBe(false);
    expect(useCanteenStore().canteenList[0].id).toBe('public-canteen');
    expect(useCanteenStore().error).toBeNull();
  });
  test('showing a cached home tab reloads recommendations for the new login', async () => {
    autoCanteens = true;
    const wrapper = shallowMount(IndexPage, { global: { stubs: { swiper: true, 'swiper-item': true, IndexSkeleton: true, SearchBar: true, FilterBar: true, RecommendItem: true, CanteenList: true } } });
    wrappers.push(wrapper);
    await flushPromises();
    latest('/recommend').success(success({ requestId: 'A-recommendation', items: [], meta }));
    await flushPromises();
    useUserStore().logoutAction();
    useUserStore().token = 'B-access';
    useUserStore().refreshToken = 'B-refresh';
    useUserStore().userInfo = profile('B') as any;
    const count = matching('/recommend').length;
    (onShow as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(matching('/recommend')).toHaveLength(count + 1);
    expect(latest('/recommend').header.Authorization).toBe('Bearer B-access');
    latest('/recommend').success(success({ requestId: 'B-recommendation', items: [], meta }));
    await flushPromises();
  });
  test.each(['recommendation', 'details'])('an old %s stage cannot finish B loading or continue with B credentials', async phase => {
    autoCanteens = true;
    const wrapper = shallowMount(IndexPage, {
      global: { stubs: { swiper: true, 'swiper-item': true, IndexSkeleton: true, SearchBar: true, FilterBar: true, RecommendItem: true, CanteenList: true } },
    });
    wrappers.push(wrapper);
    await flushPromises();
    const oldRecommendation = latest('/recommend');
    if (phase === 'details') {
      oldRecommendation.success(success({ requestId: 'A-recommendation', items: [{ id: 'A-dish' }], meta }));
      await flushPromises();
    }
    const oldStage = phase === 'details' ? latest('/dishes/by-ids') : oldRecommendation;
    await useUserStore().loginAction('B');
    const current = (wrapper.vm as any).fetchRecommendations({ reset: true });
    await flushPromises();
    oldStage.success(success(phase === 'details' ? { items: [{ id: 'A-dish' }], meta } : { requestId: 'A-recommendation', items: [{ id: 'A-dish' }], meta }));
    await flushPromises();
    const dishes = useDishesStore();
    expect(dishes.loading).toBe(true);
    expect((wrapper.vm as any).recommendError).toBeNull();
    expect((wrapper.vm as any).currentRequestId).not.toBe('A-recommendation');
    expect(matching('/dishes/by-ids').some(item => item.header.Authorization === 'Bearer B-access' && item.data.ids.includes('A-dish'))).toBe(false);
    latest('/recommend').success(success({ requestId: 'B-recommendation', items: [], meta }));
    await current;
    expect(dishes.loading).toBe(false);
  });
});
