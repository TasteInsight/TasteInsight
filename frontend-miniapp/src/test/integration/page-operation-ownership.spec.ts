import { createPinia, setActivePinia } from 'pinia';
import { effectScope, type EffectScope } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/modules/use-user-store';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useCanteenData } from '@/pages/canteen/composables/use-canteen-data';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import { usePersonal } from '@/pages/settings/composables/use-personal';
import CanteenPage from '@/pages/canteen/index.vue';
import WindowPage from '@/pages/window/index.vue';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';

jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onBackPress: jest.fn(),
  onHide: jest.fn(),
}));

const storage = new Map<string, any>();
const requests: any[] = [];
const scopes: EffectScope[] = [];
const wrappers: any[] = [];
const response = (data: any) => ({ statusCode: 200, data: { code: 200, data } });
const meta = { page: 1, pageSize: 20, totalPages: 1, total: 1 };
const matching = (pathname: string) =>
  requests.filter(item => new URL(item.url).pathname === pathname);
const latest = (pathname: string) => matching(pathname).slice(-1)[0];
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: any) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  request: jest.fn(),
  uploadFile: jest.fn(),
  chooseImage: jest.fn(),
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  navigateBack: jest.fn(),
  navigateTo: jest.fn(),
  stopPullDownRefresh: jest.fn(),
};

function consumer<T>(factory: () => T) {
  const scope = effectScope();
  scopes.push(scope);
  return { scope, value: scope.run(factory)! };
}

function switchAccount() {
  const user = useUserStore();
  user.logoutAction();
  user.token = 'B-token';
  user.userInfo = { id: 'B', nickname: 'B' } as any;
}

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
    return { abort: jest.fn() };
  });
  setActivePinia(createPinia());
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  scopes.splice(0).forEach(scope => scope.stop());
  jest.clearAllTimers();
  jest.useRealTimers();
});

test.each(['canteen', 'window'])(
  'a disposed %s initializer cannot overwrite the next page or start another stage',
  async kind => {
    const old = consumer(() => (kind === 'canteen' ? useCanteenData() : useWindowData()));
    const pendingOld = old.value.init('old');
    await flushPromises();
    const oldRequest = latest(kind === 'canteen' ? '/canteens/old' : '/windows/old');
    old.scope.stop();

    const current = consumer(() => (kind === 'canteen' ? useCanteenData() : useWindowData()));
    const pendingCurrent = current.value.init('current');
    await flushPromises();
    oldRequest.success(response({ id: 'old' }));
    await flushPromises();
    expect(current.value.loading.value).toBe(true);
    const oldInfo =
      kind === 'canteen'
        ? (old.value as ReturnType<typeof useCanteenData>).canteenInfo
        : (old.value as ReturnType<typeof useWindowData>).windowInfo;
    expect(oldInfo.value).toBeNull();
    expect(matching('/canteens/old/windows')).toHaveLength(0);
    expect(matching('/dishes')).toHaveLength(0);
    await pendingOld;

    latest(kind === 'canteen' ? '/canteens/current' : '/windows/current').success(
      response({ id: 'current' })
    );
    await flushPromises();
    if (kind === 'canteen') {
      latest('/canteens/current/windows').success(
        response({ items: [{ id: 'current-window' }], meta })
      );
      await flushPromises();
    }
    latest('/dishes').success(response({ items: [{ id: 'current-dish' }], meta }));
    await pendingCurrent;
    const currentInfo =
      kind === 'canteen'
        ? (current.value as ReturnType<typeof useCanteenData>).canteenInfo
        : (current.value as ReturnType<typeof useWindowData>).windowInfo;
    expect(currentInfo.value?.id).toBe('current');
    expect(current.value.dishes.value[0].id).toBe('current-dish');
  }
);

test.each(['canteen', 'window'])(
  'the newest %s initializer owns page data when responses arrive out of order',
  async kind => {
    const { value } = consumer(() => (kind === 'canteen' ? useCanteenData() : useWindowData()));
    const old = value.init('old');
    const current = value.init('current');
    await flushPromises();
    latest(kind === 'canteen' ? '/canteens/current' : '/windows/current').success(
      response({ id: 'current' })
    );
    await flushPromises();
    if (kind === 'canteen') {
      latest('/canteens/current/windows').success(response({ items: [], meta }));
      await flushPromises();
    }
    latest('/dishes').success(response({ items: [], meta }));
    await current;
    latest(kind === 'canteen' ? '/canteens/old' : '/windows/old').success(response({ id: 'old' }));
    await old;
    const info =
      kind === 'canteen'
        ? (value as ReturnType<typeof useCanteenData>).canteenInfo
        : (value as ReturnType<typeof useWindowData>).windowInfo;
    expect(info.value?.id).toBe('current');
    expect(value.loading.value).toBe(false);
  }
);

test.each(['canteen', 'window'])(
  'live %s pages keep their own data when navigating to another page and back',
  async kind => {
    const makePage = () =>
      consumer(() => (kind === 'canteen' ? useCanteenData() : useWindowData()));
    const finish = async (id: string) => {
      await flushPromises();
      latest(kind === 'canteen' ? `/canteens/${id}` : `/windows/${id}`).success(response({ id }));
      await flushPromises();
      if (kind === 'canteen') {
        latest(`/canteens/${id}/windows`).success(
          response({ items: [{ id: `${id}-window` }], meta })
        );
        await flushPromises();
      }
      latest('/dishes').success(response({ items: [{ id: `${id}-dish` }], meta }));
    };
    const first = makePage();
    const pendingFirst = first.value.init('first');
    await finish('first');
    await pendingFirst;
    const second = makePage();
    const pendingSecond = second.value.init('second');
    await finish('second');
    await pendingSecond;
    const firstInfo =
      kind === 'canteen'
        ? (first.value as ReturnType<typeof useCanteenData>).canteenInfo
        : (first.value as ReturnType<typeof useWindowData>).windowInfo;
    expect(firstInfo.value?.id).toBe('first');
    expect(first.value.dishes.value[0].id).toBe('first-dish');
    if (kind === 'canteen') {
      expect((first.value as ReturnType<typeof useCanteenData>).windows.value[0].id).toBe(
        'first-window'
      );
    }
  }
);

test('a page window list cannot replace another live planning dialog selection', async () => {
  useCanteenStore().canteenList = [{ id: 'planning-canteen', name: 'Planning' }] as any;
  const wrapper = shallowMount(PlanEditDialog, { props: { visible: true, plan: null } });
  wrappers.push(wrapper);
  const selection = (wrapper.vm as any).onCanteenChange({ detail: { value: 0 } });
  await flushPromises();
  latest('/canteens/planning-canteen/windows').success(
    response({ items: [{ id: 'planning-window' }], meta })
  );
  await selection;
  const { value: page } = consumer(useCanteenData);
  const loading = page.init('page-canteen');
  await flushPromises();
  latest('/canteens/page-canteen').success(response({ id: 'page-canteen' }));
  await flushPromises();
  latest('/canteens/page-canteen/windows').success(
    response({ items: [{ id: 'page-window' }], meta })
  );
  await flushPromises();
  latest('/dishes').success(response({ items: [], meta }));
  await loading;
  expect((wrapper.vm as any).windowList[0].id).toBe('planning-window');
  expect(page.windows.value[0].id).toBe('page-window');
});

test.each(['selection', 'close', 'session', 'dispose'])(
  'planning window options ignore results after %s changes',
  async change => {
    useCanteenStore().canteenList = [
      { id: 'old', name: 'Old' },
      { id: 'current', name: 'Current' },
    ] as any;
    const wrapper = shallowMount(PlanEditDialog, { props: { visible: true, plan: null } });
    wrappers.push(wrapper);
    const vm = wrapper.vm as any;
    const old = vm.onCanteenChange({ detail: { value: 0 } });
    await flushPromises();
    const oldRequest = latest('/canteens/old/windows');
    if (change === 'close') await wrapper.setProps({ visible: false });
    else if (change === 'session') switchAccount();
    else if (change === 'dispose') wrapper.unmount();
    else {
      const current = vm.onCanteenChange({ detail: { value: 1 } });
      await flushPromises();
      latest('/canteens/current/windows').success(
        response({ items: [{ id: 'current-window' }], meta })
      );
      await current;
    }
    oldRequest.success(response({ items: [{ id: 'old-window' }], meta }));
    await old;
    expect(vm.windowList.some((window: any) => window.id === 'old-window')).toBe(false);
    if (change === 'selection') expect(vm.windowList[0].id).toBe('current-window');
  }
);

test.each(['search', 'clear-search'])(
  'planning %s does not cancel pending window options for the selected canteen',
  async action => {
    useCanteenStore().canteenList = [{ id: 'canteen', name: 'Canteen' }] as any;
    const wrapper = shallowMount(PlanEditDialog, { props: { visible: true, plan: null } });
    wrappers.push(wrapper);
    const vm = wrapper.vm as any;
    const windows = vm.onCanteenChange({ detail: { value: 0 } });
    await flushPromises();
    const windowRequest = latest('/canteens/canteen/windows');
    vm.searchKeyword = 'rice';
    const searching = vm.handleSearch();
    await flushPromises();
    const searchRequest = latest('/dishes');
    if (action === 'clear-search') {
      const clearing = vm.clearSearch();
      await flushPromises();
      latest('/dishes').success(response({ items: [{ id: 'all-window-dish' }], meta }));
      await clearing;
    }
    searchRequest.success(response({ items: [{ id: 'rice' }], meta }));
    await searching;
    windowRequest.success(response({ items: [{ id: 'window' }], meta }));
    await windows;
    expect(vm.windowList.map((window: any) => window.id)).toEqual(['window']);
    expect(vm.dishList.map((dish: any) => dish.id)).toEqual(
      action === 'search' ? ['rice'] : ['all-window-dish']
    );
  }
);

test.each(['canteen', 'window'])(
  'the newest %s dish request keeps its loading state and results',
  async kind => {
    const { value } = consumer(() => (kind === 'canteen' ? useCanteenData() : useWindowData()));
    const old = value.fetchDishes('old');
    await flushPromises();
    const oldRequest = latest('/dishes');
    const current = value.fetchDishes('current');
    await flushPromises();
    oldRequest.success(response({ items: [{ id: 'old-dish' }], meta }));
    await old;
    expect(
      kind === 'canteen'
        ? (value as ReturnType<typeof useCanteenData>).dishesLoading.value
        : value.loading.value
    ).toBe(true);
    latest('/dishes').success(response({ items: [{ id: 'current-dish' }], meta }));
    await current;
    expect(value.dishes.value[0].id).toBe('current-dish');
  }
);

test('an old canteen refresh cannot issue filtered requests or show feedback in a new login', async () => {
  const wrapper = shallowMount(CanteenPage);
  wrappers.push(wrapper);
  const loading = (onLoad as jest.Mock).mock.calls[0][0]({ id: 'old' });
  await flushPromises();
  latest('/canteens/old').success(response({ id: 'old' }));
  await flushPromises();
  latest('/canteens/old/windows').success(response({ items: [], meta }));
  await flushPromises();
  latest('/dishes').success(response({ items: [], meta }));
  await loading;
  (wrapper.vm as any).currentFilter = { tags: ['A-filter'] };
  const before = matching('/dishes').length;
  const pending = (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  const oldRequest = latest('/canteens/old');
  switchAccount();
  oldRequest.success(response({ id: 'old' }));
  await flushPromises();
  expect(matching('/dishes')).toHaveLength(before);
  await pending;
  expect(uniMock.showToast).not.toHaveBeenCalled();
  expect(uniMock.stopPullDownRefresh).not.toHaveBeenCalled();
});

test.each(['success', 'failure'])(
  'a canteen pull refresh %s owns its read outcome while the original load is pending',
  async outcome => {
    const wrapper = shallowMount(CanteenPage);
    wrappers.push(wrapper);
    const initial = (onLoad as jest.Mock).mock.calls[0][0]({ id: 'canteen' });
    await flushPromises();
    const firstRequest = latest('/canteens/canteen');
    const refresh = (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    if (outcome === 'failure') latest('/canteens/canteen').fail({ errMsg: 'request:fail refresh failed' });
    else {
      latest('/canteens/canteen').success(response({ id: 'canteen' }));
      await flushPromises();
      latest('/canteens/canteen/windows').success(response({ items: [], meta }));
      await flushPromises();
      latest('/dishes').success(response({ items: [], meta }));
    }
    await refresh;
    const vm = wrapper.vm as any;
    expect(vm.loading).toBe(false);
    expect(vm.dishesLoading).toBe(false);
    expect(vm.dishesInitialized).toBe(outcome === 'success');
    expect(vm.canteenInfo?.id).toBe(outcome === 'success' ? 'canteen' : undefined);
    expect(!!vm.error).toBe(outcome === 'failure');
    const windowsRequested = matching('/canteens/canteen/windows').length;
    firstRequest.success(response({ id: 'canteen' }));
    await initial;
    expect(vm.loading).toBe(false);
    expect(vm.dishesInitialized).toBe(outcome === 'success');
    expect(vm.canteenInfo?.id).toBe(outcome === 'success' ? 'canteen' : undefined);
    expect(!!vm.error).toBe(outcome === 'failure');
    expect(matching('/canteens/canteen/windows')).toHaveLength(windowsRequested);
  }
);

test.each(['success', 'failure'])(
  'canteen metadata refresh %s finishes after a newer visible filter without replacing its dishes',
  async outcome => {
    const wrapper = shallowMount(CanteenPage);
    wrappers.push(wrapper);
    const initial = (onLoad as jest.Mock).mock.calls[0][0]({ id: 'canteen' });
    await flushPromises();
    latest('/canteens/canteen').success(response({ id: 'canteen', name: 'initial' }));
    await flushPromises();
    latest('/canteens/canteen/windows').success(response({ items: [], meta }));
    await flushPromises();
    latest('/dishes').success(response({ items: [{ id: 'initial-dish' }], meta }));
    await initial;

    const refresh = (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    const detail = latest('/canteens/canteen');
    const priorWindowCount = matching('/canteens/canteen/windows').length;
    (wrapper.vm as any).handleFilterChange({ tags: ['fresh-filter'] });
    await flushPromises();
    latest('/dishes').success(response({ items: [{ id: 'filtered-dish' }], meta }));
    await flushPromises();
    const dishRequestCount = matching('/dishes').length;
    if (outcome === 'success') detail.success(response({ id: 'canteen', name: 'refreshed' }));
    else detail.fail({ errMsg: 'request:fail refresh failed' });
    await flushPromises();
    if (matching('/canteens/canteen/windows').length > priorWindowCount) {
      latest('/canteens/canteen/windows').success(
        response({ items: [{ id: 'refreshed-window' }], meta })
      );
    }
    await flushPromises();
    expect(matching('/dishes')).toHaveLength(dishRequestCount);
    await refresh;
    expect(uniMock.stopPullDownRefresh).toHaveBeenCalledTimes(1);
    expect((wrapper.vm as any).dishes.map((dish: any) => dish.id)).toEqual(['filtered-dish']);
    if (outcome === 'success') {
      expect((wrapper.vm as any).canteenInfo.name).toBe('refreshed');
      expect((wrapper.vm as any).windows[0].id).toBe('refreshed-window');
    }
  }
);

test('window pagination waits for both refresh resources before starting the next page', async () => {
  const wrapper = shallowMount(WindowPage);
  wrappers.push(wrapper);
  const vm = wrapper.vm as any;
  const initial = (onLoad as jest.Mock).mock.calls[0][0]({ id: 'window' });
  await flushPromises();
  latest('/windows/window').success(response({ id: 'window', name: 'initial' }));
  await flushPromises();
  latest('/dishes').success(
    response({ items: [{ id: 'initial' }], meta: { ...meta, totalPages: 2 } })
  );
  await initial;

  const refreshing = vm.onRefresh();
  await flushPromises();
  const header = latest('/windows/window');
  latest('/dishes').success(
    response({ items: [{ id: 'fresh' }], meta: { ...meta, totalPages: 2 } })
  );
  await flushPromises();
  const requestCount = matching('/dishes').length;
  const nextPage = vm.onLoadMore();
  await flushPromises();
  expect(matching('/dishes')).toHaveLength(requestCount);
  header.success(response({ id: 'window', name: 'refreshed' }));
  await refreshing;
  await nextPage;
  expect(vm.refresherTriggered).toBe(false);
  expect(vm.windowInfo.name).toBe('refreshed');

  const availableNextPage = vm.onLoadMore();
  await flushPromises();
  expect(latest('/dishes').data.pagination.page).toBe(2);
  latest('/dishes').success(
    response({ items: [{ id: 'next' }], meta: { ...meta, page: 2, totalPages: 2 } })
  );
  await availableNextPage;
  expect(vm.dishes.map((dish: any) => dish.id)).toEqual(['fresh', 'next']);
});

async function initializePersonal(personal: ReturnType<typeof usePersonal>) {
  const loading = personal.loadProfile();
  await flushPromises();
  const user = useUserStore().userInfo!;
  latest('/user/profile').success(response({ id: user.id, nickname: user.nickname }));
  await loading;
}

test.each(['dispose', 'session'])('profile navigation is canceled on %s without canceling the next page timer', async change => {
  const old = consumer(usePersonal);
  await initializePersonal(old.value);
  old.value.form.nickname = 'old saved name';
  const pending = old.value.handleSave();
  await flushPromises();
  latest('/user/profile').success(response({ nickname: 'old saved name' }));
  await pending;
  if (change === 'dispose') old.scope.stop();
  else switchAccount();
  const current = consumer(usePersonal);
  await initializePersonal(current.value);
  current.value.form.nickname = 'current saved name';
  const currentSave = current.value.handleSave();
  await flushPromises();
  latest('/user/profile').success(response({ nickname: 'current saved name' }));
  await currentSave;
  jest.advanceTimersByTime(1000);
  expect(uniMock.navigateBack).toHaveBeenCalledTimes(1);
});

test('a disposed avatar picker cannot start uploads or navigate to cropping', async () => {
  const old = consumer(usePersonal);
  await initializePersonal(old.value);
  const pending = old.value.chooseAvatar();
  const picker = uniMock.chooseImage.mock.calls[0][0];
  old.scope.stop();
  picker.success({ tempFilePaths: ['/tmp/old-avatar.jpg'] });
  await flushPromises();
  expect(uniMock.uploadFile).not.toHaveBeenCalled();
  expect(uniMock.navigateTo).not.toHaveBeenCalled();
  await pending;
});

test.each([false, true])('a pending or completed save blocks a new avatar selection: %s', async chooseBeforeSaveFinishes => {
  const { value: personal } = consumer(usePersonal);
  await initializePersonal(personal);
  personal.form.nickname = 'saved name';
  const saving = personal.handleSave();
  await flushPromises();
  if (chooseBeforeSaveFinishes) await personal.chooseAvatar();
  latest('/user/profile').success(response({ nickname: 'saved name' }));
  await saving;
  if (!chooseBeforeSaveFinishes) await personal.chooseAvatar();
  expect(uniMock.chooseImage).not.toHaveBeenCalled();
  expect(uniMock.uploadFile).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1000);
  expect(uniMock.navigateBack).toHaveBeenCalledTimes(1);
});

test('a disposed crop callback cannot upload or hide a later page loading state', async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const old = consumer(usePersonal);
    await initializePersonal(old.value);
    const pending = old.value.chooseAvatar();
    uniMock.chooseImage.mock.calls[0][0].success({ tempFilePaths: ['/tmp/old-avatar.jpg'] });
    const eventChannel = { emit: jest.fn(), on: jest.fn() };
    uniMock.navigateTo.mock.calls[0][0].success({ eventChannel });
    old.scope.stop();
    uniMock.hideLoading.mockClear();
    eventChannel.on.mock.calls[0][1]({ tempFilePath: '/tmp/old-cropped.jpg' });
    await pending;
    expect(uniMock.uploadFile).not.toHaveBeenCalled();
    expect(uniMock.hideLoading).not.toHaveBeenCalled();
  } finally {
    process.env.NODE_ENV = previousEnvironment;
  }
});

test('a disposed avatar upload releases only its loading state and ignores its late result', async () => {
  const old = consumer(usePersonal);
  await initializePersonal(old.value);
  const pendingOld = old.value.chooseAvatar();
  uniMock.chooseImage.mock.calls[0][0].success({ tempFilePaths: ['/tmp/old-avatar.jpg'] });
  const oldUpload = uniMock.uploadFile.mock.calls[0][0];
  old.scope.stop();
  expect(uniMock.hideLoading).toHaveBeenCalledTimes(1);

  const current = consumer(usePersonal);
  await initializePersonal(current.value);
  const pendingCurrent = current.value.chooseAvatar();
  uniMock.chooseImage.mock.calls[1][0].success({ tempFilePaths: ['/tmp/current-avatar.jpg'] });
  oldUpload.fail(new Error('old upload failed'));
  await pendingOld;
  expect(current.value.uploading.value).toBe(true);
  expect(uniMock.hideLoading).toHaveBeenCalledTimes(1);
  expect(uniMock.showToast).not.toHaveBeenCalled();
  uniMock.uploadFile.mock.calls[1][0].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url: 'https://images.test/current.jpg' } }) });
  await pendingCurrent;
  expect(current.value.form.avatar).toBe('https://images.test/current.jpg');
  expect(uniMock.hideLoading).toHaveBeenCalledTimes(2);
});
