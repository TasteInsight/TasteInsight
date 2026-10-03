import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { onReachBottom } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/modules/use-user-store';
import { useSearch } from '@/pages/search/composables/use-search';
import SearchPage from '@/pages/search/index.vue';
import PlanningPage from '@/pages/planning/index.vue';
import PlanEditDialog from '@/pages/planning/components/PlanEditDialog.vue';
import AddDishPage from '@/pages/add-dish/index.vue';
import PreferencesPage from '@/pages/settings/components/preferences.vue';
import DisplayPage from '@/pages/settings/components/display.vue';
import AllergensPage from '@/pages/settings/components/allergens.vue';
import NotificationsPage from '@/pages/settings/components/notifications.vue';

jest.mock('@dcloudio/uni-app', () => ({
  onReachBottom: jest.fn(), onHide: jest.fn(), onBackPress: jest.fn(), onPullDownRefresh: jest.fn(),
}));

const storage = new Map<string, any>();
const requests: any[] = [];
const wrappers: any[] = [];
let autoProfiles = true;
const profile = (id = 'A') => ({
  id, nickname: id, allergens: ['牛奶'],
  preferences: {
    meatPreference: ['牛肉'], priceRange: { min: 10, max: 50 },
    canteenPreferences: ['canteen'], avoidIngredients: ['葱'], favoriteIngredients: ['番茄'],
  },
});
const ok = (data: any) => ({ statusCode: 200, data: { code: 200, data } });
const meta = { page: 1, pageSize: 20, totalPages: 3, total: 50 };
const matching = (path: string, method?: string) => requests.filter(item =>
  new URL(item.url).pathname === path && (!method || item.method === method));
const latest = (path: string, method?: string) => matching(path, method).slice(-1)[0];
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: any) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  request: jest.fn(), showToast: jest.fn(), navigateBack: jest.fn(),
  chooseImage: jest.fn(), uploadFile: jest.fn(), $on: jest.fn(), $off: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  storage.clear();
  storage.set('token', 'A-token');
  storage.set('userInfo', JSON.stringify(profile()));
  requests.length = 0;
  autoProfiles = true;
  (global as any).uni = uniMock;
  (global as any).getCurrentPages = () => [];
  uniMock.request.mockImplementation(options => {
    requests.push(options);
    const path = new URL(options.url).pathname;
    if (autoProfiles && path === '/user/profile' && options.method === 'GET') {
      options.success(ok(profile(useUserStore().userInfo?.id)));
    } else if (path === '/dishes/selected') {
      options.success(ok({ id: 'selected', name: 'rice' }));
    } else if (path === '/canteens' || (path === '/meal-plans' && options.method === 'GET')) {
      options.success(ok({ items: [], meta: { ...meta, totalPages: 1 } }));
    }
    return { abort: jest.fn() };
  });
  setActivePinia(createPinia());
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function page(component: any, realDialog = false) {
  const wrapper = shallowMount(component, { global: { stubs: realDialog ? { PlanEditDialog: false } : {} } });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

function switchAccount() {
  const user = useUserStore();
  user.logoutAction();
  user.token = 'B-token';
  user.userInfo = profile('B') as any;
}

const settingsPages = [
  ['preferences', PreferencesPage], ['display', DisplayPage],
  ['allergens', AllergensPage], ['notifications', NotificationsPage],
] as const;

describe.each(settingsPages)('%s settings real page lifecycle', (_name, component) => {
  test('a disposed profile load cannot replace the next page profile', async () => {
    autoProfiles = false;
    const old = await page(component);
    const request = latest('/user/profile', 'GET');
    old.unmount();
    autoProfiles = true;
    const current = await page(component);
    useUserStore().updateLocalUserInfo({ nickname: 'current profile' });
    request.success(ok({ ...profile(), nickname: 'late profile' }));
    await flushPromises();
    expect(useUserStore().userInfo?.nickname).toBe('current profile');
    expect((current.vm as any).loading).toBe(false);
    expect(uniMock.showToast).not.toHaveBeenCalled();
  });

  test.each(['dispose', 'session'])('saved navigation is canceled by %s without canceling a later page timer', async change => {
    const old = await page(component);
    const pending = (old.vm as any).handleSave();
    await flushPromises();
    latest('/user/profile', 'PUT').success(ok(profile()));
    await expect(pending).resolves.toBe(true);
    expect(matching('/user/profile', 'GET')).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(1);
    if (change === 'dispose') old.unmount();
    else switchAccount();
    expect(jest.getTimerCount()).toBe(0);
    const current = await page(component);
    const saving = (current.vm as any).handleSave();
    await flushPromises();
    latest('/user/profile', 'PUT').success(ok(profile(useUserStore().userInfo?.id)));
    await saving;
    jest.advanceTimersByTime(1000);
    expect(uniMock.navigateBack).toHaveBeenCalledTimes(1);
  });

  test.each(['dispose', 'session'])('a pending save settled after %s synchronizes only its account without page effects', async change => {
    const old = await page(component);
    const pending = (old.vm as any).handleSave();
    await flushPromises();
    const request = latest('/user/profile', 'PUT');
    if (change === 'dispose') old.unmount();
    else switchAccount();
    if (change === 'session') useUserStore().updateLocalUserInfo({ nickname: 'current profile' });
    request.success(ok({ ...profile(), nickname: 'late profile' }));
    await expect(pending).resolves.toBe(false);
    expect(useUserStore().userInfo?.nickname).toBe(change === 'dispose' ? 'late profile' : 'current profile');
    expect(uniMock.showToast).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('failed save retains its editable draft and releases saving', async () => {
    const wrapper = await page(component);
    const vm = wrapper.vm as any;
    const before = JSON.parse(JSON.stringify(vm.form));
    const pending = vm.handleSave();
    await flushPromises();
    latest('/user/profile', 'PUT').success({ statusCode: 500, data: { code: 500, message: 'save failed' } });
    await expect(pending).resolves.toBe(false);
    expect(vm.form).toEqual(before);
    expect(vm.saving).toBe(false);
    expect(uniMock.showToast).toHaveBeenCalledWith({ title: '网络开小差了，请稍后再试', icon: 'none' });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('an old account completion cannot release a new pending save on the same page', async () => {
    const wrapper = await page(component);
    const vm = wrapper.vm as any;
    const old = vm.handleSave();
    await flushPromises();
    const oldRequest = latest('/user/profile', 'PUT');
    switchAccount();
    const current = vm.handleSave();
    await flushPromises();
    const currentRequest = latest('/user/profile', 'PUT');
    expect(currentRequest.header.Authorization).toBe('Bearer B-token');
    oldRequest.success(ok(profile()));
    await expect(old).resolves.toBe(false);
    expect(vm.saving).toBe(true);
    expect(useUserStore().userInfo?.id).toBe('B');
    expect(uniMock.showToast).not.toHaveBeenCalled();
    currentRequest.success(ok(profile('B')));
    await expect(current).resolves.toBe(true);
    expect(vm.saving).toBe(false);
  });

  test('a second save owns navigation and duplicate pending saves are ignored', async () => {
    const wrapper = await page(component);
    const vm = wrapper.vm as any;
    const first = vm.handleSave();
    await flushPromises();
    latest('/user/profile', 'PUT').success(ok(profile()));
    await first;
    const second = vm.handleSave();
    const duplicate = vm.handleSave();
    await flushPromises();
    expect(matching('/user/profile', 'PUT')).toHaveLength(2);
    await expect(duplicate).resolves.toBe(false);
    jest.advanceTimersByTime(1000);
    expect(uniMock.navigateBack).not.toHaveBeenCalled();
    latest('/user/profile', 'PUT').success(ok(profile()));
    await second;
    jest.advanceTimersByTime(1000);
    expect(uniMock.navigateBack).toHaveBeenCalledTimes(1);
  });
});

test('a disposed setting write reconciles an older complete User response with newer local information', async () => {
  const old = await page(DisplayPage);
  const vm = old.vm as any;
  vm.form.showCalories = false;
  const saving = vm.handleSave();
  await flushPromises();
  const request = latest('/user/profile', 'PUT');
  old.unmount();
  useUserStore().updateLocalUserInfo({ nickname: 'new name' });
  autoProfiles = false;
  request.success(ok({ ...profile(), settings: { displaySettings: { showCalories: false } } }));
  await flushPromises();
  expect(useUserStore().userInfo?.nickname).toBe('new name');
  expect(matching('/user/profile', 'GET')).toHaveLength(2);
  latest('/user/profile', 'GET').success(ok({
    ...profile(), nickname: 'new name', settings: { displaySettings: { showCalories: false } },
  }));
  await saving;
  expect(useUserStore().userInfo?.nickname).toBe('new name');
  expect(useUserStore().userInfo?.settings?.displaySettings?.showCalories).toBe(false);
  expect(uniMock.showToast).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('reversed saves of the same setting use the current server profile instead of an old full response', async () => {
  const old = await page(DisplayPage);
  (old.vm as any).form.showCalories = false;
  const first = (old.vm as any).handleSave();
  await flushPromises();
  const oldRequest = latest('/user/profile', 'PUT');
  old.unmount();
  const current = await page(DisplayPage);
  (current.vm as any).form.showCalories = true;
  const second = (current.vm as any).handleSave();
  await flushPromises();
  const finalProfile = { ...profile(), settings: { displaySettings: { showCalories: true } } };
  latest('/user/profile', 'PUT').success(ok(finalProfile));
  await second;
  autoProfiles = false;
  oldRequest.success(ok({ ...profile(), settings: { displaySettings: { showCalories: false } } }));
  await flushPromises();
  expect(matching('/user/profile', 'GET')).toHaveLength(3);
  expect(useUserStore().userInfo?.settings?.displaySettings?.showCalories).toBe(true);
  latest('/user/profile', 'GET').success(ok(finalProfile));
  await first;
  expect(useUserStore().userInfo?.settings?.displaySettings?.showCalories).toBe(true);
  expect(uniMock.showToast).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000);
  expect(uniMock.navigateBack).toHaveBeenCalledTimes(1);
});

test('a successful write remains successful if conflict reconciliation fails', async () => {
  const wrapper = await page(DisplayPage);
  const pending = (wrapper.vm as any).handleSave();
  await flushPromises();
  useUserStore().updateLocalUserInfo({ nickname: 'current name' });
  autoProfiles = false;
  latest('/user/profile', 'PUT').success(ok(profile()));
  await flushPromises();
  expect(matching('/user/profile', 'GET')).toHaveLength(2);
  latest('/user/profile', 'GET').success({ statusCode: 500, data: { code: 500 } });
  await expect(pending).resolves.toBe(true);
  expect(useUserStore().userInfo?.nickname).toBe('current name');
  expect(uniMock.showToast).toHaveBeenCalledTimes(1);
  expect(uniMock.showToast).toHaveBeenCalledWith({ title: '保存成功', icon: 'success' });
});

test.each(['dispose', 'session', 'newer profile'])('profile reconciliation after %s has no stale page or account effects', async change => {
  const wrapper = await page(DisplayPage);
  const pending = (wrapper.vm as any).handleSave();
  await flushPromises();
  useUserStore().updateLocalUserInfo({ nickname: 'newer name' });
  autoProfiles = false;
  latest('/user/profile', 'PUT').success(ok(profile()));
  await flushPromises();
  const refresh = latest('/user/profile', 'GET');
  expect(matching('/user/profile', 'GET')).toHaveLength(2);
  if (change === 'session') switchAccount();
  else {
    wrapper.unmount();
    if (change === 'newer profile') useUserStore().updateLocalUserInfo({ nickname: 'newest name' });
  }
  refresh.success(change === 'dispose' ? { statusCode: 500, data: { code: 500 } }
    : ok({ ...profile(), nickname: 'stale refreshed name' }));
  await expect(pending).resolves.toBe(false);
  expect(useUserStore().userInfo?.nickname).toBe(change === 'session' ? 'B'
    : change === 'newer profile' ? 'newest name' : 'newer name');
  expect(uniMock.showToast).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('a profile read begun before a successful save cannot roll that save back', async () => {
  const wrapper = await page(DisplayPage);
  autoProfiles = false;
  const reading = useUserStore().fetchProfileAction();
  await flushPromises();
  const oldRead = latest('/user/profile', 'GET');
  const saving = (wrapper.vm as any).handleSave();
  await flushPromises();
  latest('/user/profile', 'PUT').success(ok({ ...profile(), nickname: 'saved name' }));
  await saving;
  oldRead.success(ok(profile()));
  await reading;
  expect(useUserStore().userInfo?.nickname).toBe('saved name');
  expect(matching('/user/profile', 'GET')).toHaveLength(2);
});

test('preferences edit nested snapshots without changing stored preferences before a successful save', async () => {
  const wrapper = await page(PreferencesPage);
  const vm = wrapper.vm as any;
  const initial = JSON.parse(JSON.stringify(useUserStore().userInfo?.preferences));
  vm.form.meatPreference.push('鸡肉');
  vm.form.priceRange.min = 15;
  vm.form.canteenPreferences.push('other');
  vm.form.avoidIngredients.push('蒜');
  vm.form.favoriteIngredients.push('白菜');
  expect(useUserStore().userInfo?.preferences).toEqual(initial);
  const pending = vm.handleSave();
  await flushPromises();
  const submitted = latest('/user/profile', 'PUT').data.preferences;
  vm.form.favoriteIngredients.push('later edit');
  expect(submitted.favoriteIngredients).not.toContain('later edit');
  latest('/user/profile', 'PUT').success(ok({ ...profile(), preferences: submitted }));
  await pending;
  expect(useUserStore().userInfo?.preferences?.favoriteIngredients).toEqual(['番茄', '白菜']);
});

test('the real search page registers the UniApp reach-bottom hook and loads page two', async () => {
  const wrapper = await page(SearchPage);
  const vm = wrapper.vm as any;
  vm.keyword = 'rice';
  vm.handleSearch();
  await flushPromises();
  latest('/dishes').success(ok({ items: [{ id: 'first' }], meta }));
  await flushPromises();
  expect(onReachBottom).toHaveBeenCalledTimes(1);
  (onReachBottom as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(latest('/dishes').data.pagination.page).toBe(2);
  latest('/dishes').success(ok({ items: [{ id: 'second' }], meta: { ...meta, page: 2 } }));
  await flushPromises();
  expect(vm.searchResults.dishes.map((dish: any) => dish.id)).toEqual(['first', 'second']);
});

test.each(['clear', 'replace'])('an old pagination completion cannot release the new pagination owner after %s', async change => {
  const search = useSearch();
  search.keyword.value = 'A';
  const first = search.search();
  await flushPromises();
  latest('/dishes').success(ok({ items: [{ id: 'A1' }], meta }));
  await first;
  const old = search.loadMore();
  await flushPromises();
  const oldRequest = latest('/dishes');
  if (change === 'clear') search.clearSearch();
  search.keyword.value = 'B';
  const current = search.search();
  await flushPromises();
  latest('/dishes').success(ok({ items: [{ id: 'B1' }], meta }));
  await current;
  const more = search.loadMore();
  await flushPromises();
  const moreRequest = latest('/dishes');
  expect(moreRequest.data.search.keyword).toBe('B');
  expect(moreRequest.data.pagination.page).toBe(2);
  oldRequest.success(ok({ items: [{ id: 'A2' }], meta: { ...meta, page: 2 } }));
  await old;
  expect(search.loadingMore.value).toBe(true);
  await search.loadMore();
  expect(latest('/dishes')).toBe(moreRequest);
  moreRequest.success(ok({ items: [{ id: 'B2' }], meta: { ...meta, page: 2 } }));
  await more;
  expect(search.searchResults.value.dishes.map(dish => dish.id)).toEqual(['B1', 'B2']);
  expect(search.loadingMore.value).toBe(false);
});

test.each(['create', 'edit'])('the real planning %s dialog retains a reopened draft while the old save completes', async kind => {
  const wrapper = await page(PlanningPage, true);
  const vm = wrapper.vm as any;
  const body = { startDate: '2099-10-03', endDate: '2099-10-03', mealTime: 'lunch', dishes: ['selected'] };
  const open = (id: string) => kind === 'create' ? vm.createNewPlan()
    : vm.editPlan({ id, ...body, dishes: [{ id: 'selected', name: 'rice' }] });
  const close = () => kind === 'create' ? vm.closeCreateDialog() : vm.closeEditDialog();
  const submit = () => kind === 'create' ? vm.submitCreate(body) : vm.submitEdit(body);
  const path = (id: string) => kind === 'create' ? '/meal-plans' : `/meal-plans/${id}`;
  open('A');
  const old = submit();
  await flushPromises();
  const oldRequest = latest(path('A'));
  close();
  await flushPromises();
  open('B');
  await flushPromises();
  const dialog = wrapper.findAllComponents(PlanEditDialog)[kind === 'create' ? 1 : 0].vm as any;
  dialog.formData.startDate = '2099-11-01';
  const current = submit();
  await flushPromises();
  const currentRequest = latest(path('B'));
  expect(currentRequest).not.toBe(oldRequest);
  oldRequest.success(ok({ id: 'A', ...body }));
  await old;
  await flushPromises();
  expect(kind === 'create' ? vm.showCreateDialog : vm.showEditDialog).toBe(true);
  expect(dialog.formData.startDate).toBe('2099-11-01');
  expect(vm.submitting).toBe(true);
  currentRequest.success(ok({ id: 'B', ...body }));
  await current;
  expect(kind === 'create' ? vm.showCreateDialog : vm.showEditDialog).toBe(false);
  expect(vm.submitting).toBe(false);
});

test.each(['create', 'edit'])('a failed planning %s save keeps the current draft open for retry', async kind => {
  const wrapper = await page(PlanningPage, true);
  const vm = wrapper.vm as any;
  const body = { startDate: '2099-10-03', endDate: '2099-10-03', mealTime: 'lunch', dishes: ['selected'] };
  if (kind === 'create') vm.createNewPlan();
  else vm.editPlan({ id: 'draft', ...body, dishes: [{ id: 'selected', name: 'rice' }] });
  await flushPromises();
  const dialog = wrapper.findAllComponents(PlanEditDialog)[kind === 'create' ? 1 : 0].vm as any;
  Object.assign(dialog.formData, body);
  const pending = kind === 'create' ? vm.submitCreate(body) : vm.submitEdit(body);
  const rejected = expect(pending).rejects.toThrow();
  await flushPromises();
  latest(kind === 'create' ? '/meal-plans' : '/meal-plans/draft').success({
    statusCode: 500, data: { code: 500, message: 'save failed' },
  });
  await rejected;
  expect(kind === 'create' ? vm.showCreateDialog : vm.showEditDialog).toBe(true);
  expect(dialog.formData).toMatchObject(body);
  expect(vm.submitting).toBe(false);
});

test.each(['success', 'failure'])('a reversed old planning %s cannot close the next draft after the new save finishes', async outcome => {
  const wrapper = await page(PlanningPage, true);
  const vm = wrapper.vm as any;
  const body = { startDate: '2099-10-03', endDate: '2099-10-03', mealTime: 'lunch', dishes: ['selected'] };
  vm.createNewPlan();
  const old = vm.submitCreate(body);
  await flushPromises();
  const oldRequest = latest('/meal-plans', 'POST');
  vm.closeCreateDialog();
  await flushPromises();
  vm.createNewPlan();
  const current = vm.submitCreate(body);
  await flushPromises();
  latest('/meal-plans', 'POST').success(ok({ id: 'new', ...body }));
  await current;
  await flushPromises();
  vm.createNewPlan();
  await flushPromises();
  const dialog = wrapper.findAllComponents(PlanEditDialog)[1].vm as any;
  dialog.formData.startDate = '2099-12-01';
  oldRequest.success(outcome === 'success' ? ok({ id: 'old', ...body })
    : { statusCode: 500, data: { code: 500, message: 'old failure' } });
  await old;
  await flushPromises();
  expect(vm.showCreateDialog).toBe(true);
  expect(dialog.formData.startDate).toBe('2099-12-01');
  expect(vm.submitting).toBe(false);
});

test.each(['pending', 'timer'])('leaving the real add-dish page cancels its %s navigation', async phase => {
  const wrapper = await page(AddDishPage);
  const vm = wrapper.vm as any;
  Object.assign(vm.formData, {
    name: 'rice', price: 10, canteenName: '食堂', windowName: '窗口', availableMealTime: ['lunch'],
  });
  const pending = vm.submitForm();
  await flushPromises();
  const request = latest('/dishes/upload');
  if (phase === 'pending') wrapper.unmount();
  request.success(ok({ id: 'created' }));
  await pending;
  if (phase === 'timer') wrapper.unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.advanceTimersByTime(1500);
  expect(uniMock.navigateBack).not.toHaveBeenCalled();
});

test.each(['selection', 'upload'])('a disposed add-dish %s cannot continue to publish a dish', async phase => {
  const wrapper = await page(AddDishPage);
  const vm = wrapper.vm as any;
  Object.assign(vm.formData, {
    name: 'rice', price: 10, canteenName: '食堂', windowName: '窗口', availableMealTime: ['lunch'],
  });
  vm.chooseImages();
  const selection = uniMock.chooseImage.mock.calls[0][0];
  if (phase === 'selection') wrapper.unmount();
  selection.success({ tempFilePaths: ['/tmp/dish.jpg'] });
  if (phase === 'selection') {
    expect(vm.formData.images).toEqual([]);
  } else {
    const pending = vm.submitForm();
    await flushPromises();
    wrapper.unmount();
    uniMock.uploadFile.mock.calls[0][0].success({
      statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/dish.jpg' } }),
    });
    await expect(pending).resolves.toBe(false);
  }
  expect(matching('/dishes/upload')).toHaveLength(0);
  expect(uniMock.showToast).not.toHaveBeenCalled();
});
