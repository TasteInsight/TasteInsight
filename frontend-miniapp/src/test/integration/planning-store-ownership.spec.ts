import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { onHide, onShow } from '@dcloudio/uni-app';
import PlanningPage from '@/pages/planning/index.vue';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { useUserStore } from '@/store/modules/use-user-store';
import type { MealPlan, MealPlanRequest } from '@/types/api';

jest.mock('@dcloudio/uni-app', () => ({
  onReachBottom: jest.fn(), onHide: jest.fn(), onShow: jest.fn(), onBackPress: jest.fn(), onPullDownRefresh: jest.fn(),
}));

const body = (mealTime: MealPlan['mealTime'] = 'lunch'): MealPlanRequest => ({
  startDate: '2099-10-03', endDate: '2099-10-03', mealTime, dishes: ['selected'],
});
const plan = (id: string, mealTime: MealPlan['mealTime'] = 'lunch'): MealPlan => ({
  ...body(mealTime), id, userId: 'A', createdAt: '2026-10-03T00:00:00.000Z',
} as MealPlan);
const ok = (data: unknown) => ({ statusCode: 200, data: { code: 200, data } });
const failure = { statusCode: 500, data: { code: 500, message: 'save failed' } };
const storage = new Map<string, any>();
const requests: any[] = [];
const wrappers: any[] = [];
let initialPlans: MealPlan[];
let autoRead: boolean;
const matching = (method: string, path = '/meal-plans') => requests.filter(request =>
  request.method === method && new URL(request.url).pathname === path);
const latest = (method: string, path = '/meal-plans') => matching(method, path).slice(-1)[0];
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: any) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  request: jest.fn(), showToast: jest.fn(), showModal: jest.fn(), $on: jest.fn(), $off: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  storage.clear();
  storage.set('token', 'A-token');
  storage.set('userInfo', JSON.stringify({ id: 'A', nickname: 'A' }));
  requests.length = 0;
  initialPlans = [];
  autoRead = true;
  (global as any).uni = uniMock;
  uniMock.request.mockImplementation(options => {
    requests.push(options);
    const path = new URL(options.url).pathname;
    if (autoRead && options.method === 'GET' && path === '/meal-plans') {
      options.success(ok({ items: initialPlans }));
    } else if (path === '/canteens') {
      options.success(ok({ items: [], meta: { page: 1, totalPages: 1 } }));
    } else if (path === '/dishes/selected') {
      options.success(ok({ id: 'selected', name: 'rice' }));
    }
    return { abort: jest.fn() };
  });
  uniMock.showModal.mockImplementation(options => options.success({ confirm: true }));
  setActivePinia(createPinia());
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function page() {
  const wrapper = shallowMount(PlanningPage, { global: { stubs: { PlanEditDialog: false } } });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

function hidePage() {
  expect(onHide).toHaveBeenCalledTimes(1);
  (onHide as jest.Mock).mock.calls[0][0]();
}

function showPage() {
  (onShow as jest.Mock).mock.calls.forEach(([callback]) => callback());
}

test.each(['success', 'failure'])('a closed create finishing with %s preserves the newer visible plan', async outcome => {
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.createNewPlan();
  const old = vm.submitCreate(body());
  await flushPromises();
  const oldRequest = latest('POST');
  vm.closeCreateDialog();
  vm.createNewPlan();
  const current = vm.submitCreate(body('dinner'));
  await flushPromises();
  latest('POST').success(ok(plan('new', 'dinner')));
  await current;
  oldRequest.success(outcome === 'success' ? ok(plan('old')) : failure);
  await old;
  await flushPromises();

  const expectedIds = outcome === 'success' ? ['old', 'new'] : ['new'];
  expect(usePlanStore().allPlans.map(item => item.id)).toEqual(expectedIds);
  expect(vm.error).toBeNull();
  expect(wrapper.findAllComponents({ name: 'PlanCard' })).toHaveLength(expectedIds.length);
  expect(uniMock.showToast).not.toHaveBeenCalled();
});

test('reopened edits of one plan reach the server in submission order', async () => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.editPlan(vm.currentPlans[0]);
  const old = vm.submitEdit(body('breakfast'));
  await flushPromises();
  const first = latest('PATCH', '/meal-plans/existing');
  vm.closeEditDialog();
  vm.editPlan(vm.currentPlans[0]);
  const current = vm.submitEdit(body('dinner'));
  await flushPromises();

  expect(matching('PATCH', '/meal-plans/existing')).toHaveLength(1);
  expect(first.data).toEqual(body('breakfast'));
  first.success(ok(plan('existing', 'breakfast')));
  await old;
  await flushPromises();
  expect(vm.showEditDialog).toBe(true);
  expect(vm.submitting).toBe(true);
  const second = latest('PATCH', '/meal-plans/existing');
  expect(second).not.toBe(first);
  expect(second.data).toEqual(body('dinner'));
  second.success(ok(plan('existing', 'dinner')));
  await current;
  await flushPromises();

  expect(usePlanStore().allPlans[0].mealTime).toBe('dinner');
  expect(wrapper.findComponent({ name: 'PlanCard' }).props('plan').mealTime).toBe('dinner');
  expect(vm.showEditDialog).toBe(false);
});

test('writes to different plans remain concurrent and retain both successful snapshots', async () => {
  const store = usePlanStore();
  store.allPlans = [plan('first'), plan('second')];
  const first = store.updatePlan('first', body('breakfast'));
  const second = store.updatePlan('second', body('dinner'));
  await flushPromises();
  expect(matching('PATCH', '/meal-plans/first')).toHaveLength(1);
  expect(matching('PATCH', '/meal-plans/second')).toHaveLength(1);
  latest('PATCH', '/meal-plans/second').success(ok(plan('second', 'dinner')));
  await second;
  latest('PATCH', '/meal-plans/first').success(ok(plan('first', 'breakfast')));
  await first;
  expect(store.allPlans.map(item => item.mealTime)).toEqual(['breakfast', 'dinner']);
});

test('a queued update retains the submitted fields and dish ids when its draft changes', async () => {
  const store = usePlanStore();
  const first = store.updatePlan('existing', body('breakfast'));
  const draft = body('dinner');
  const second = store.updatePlan('existing', draft);
  draft.mealTime = 'lunch';
  draft.dishes!.push('later-selection');
  await flushPromises();
  matching('PATCH', '/meal-plans/existing')[0].success(ok(plan('existing', 'breakfast')));
  await first;
  await flushPromises();
  const queuedRequest = latest('PATCH', '/meal-plans/existing');
  expect(queuedRequest.data).toEqual(body('dinner'));
  queuedRequest.success(ok(plan('existing', 'dinner')));
  await second;
});

test.each(['success', 'failure'])('delete waits for a pending update that ends in %s', async outcome => {
  const store = usePlanStore();
  store.allPlans = [plan('existing')];
  const updating = store.updatePlan('existing', body('breakfast'));
  const updated = updating.catch(error => error);
  const deleting = store.removePlan('existing');
  await flushPromises();
  expect(matching('DELETE', '/meal-plans/existing')).toHaveLength(0);
  latest('PATCH', '/meal-plans/existing').success(outcome === 'success'
    ? ok(plan('existing', 'breakfast')) : failure);
  await updated;
  await flushPromises();
  latest('DELETE', '/meal-plans/existing').success(ok(null));
  await deleting;
  expect(store.allPlans).toEqual([]);
  expect(store.error).toBeNull();
});

test.each(['success', 'failure'])('a list %s overlapping a committed write reads back without replacing the write', async outcome => {
  const store = usePlanStore();
  store.allPlans = [plan('existing')];
  autoRead = false;
  const fetching = store.fetchPlans();
  await flushPromises();
  const staleRead = latest('GET');
  const saving = store.updatePlan('existing', body('dinner'));
  await flushPromises();
  latest('PATCH', '/meal-plans/existing').success(ok(plan('existing', 'dinner')));
  await saving;
  expect(store.loading).toBe(true);
  staleRead.success(outcome === 'success' ? ok({ items: [plan('existing')] }) : failure);
  await flushPromises();

  expect(store.allPlans[0].mealTime).toBe('dinner');
  expect(store.error).toBeNull();
  expect(store.loading).toBe(true);
  expect(matching('GET')).toHaveLength(2);
  latest('GET').success(ok({ items: [plan('existing', 'dinner'), plan('remote')] }));
  await fetching;
  expect(store.allPlans.map(item => item.id)).toEqual(['existing', 'remote']);
  expect(store.loading).toBe(false);
});

test('a pending write remains visible when a later read returns before its response', async () => {
  const store = usePlanStore();
  store.allPlans = [plan('existing')];
  autoRead = false;
  const saving = store.updatePlan('existing', body('dinner'));
  const fetching = store.fetchPlans();
  await flushPromises();
  latest('GET').success(ok({ items: [plan('existing')] }));
  await fetching;
  latest('PATCH', '/meal-plans/existing').success(ok(plan('existing', 'dinner')));
  await saving;
  expect(store.allPlans[0].mealTime).toBe('dinner');
});

test('a create response preserves the snapshot already observed by a concurrent list read', async () => {
  const store = usePlanStore();
  autoRead = false;
  const saving = store.createPlan(body());
  const fetching = store.fetchPlans();
  await flushPromises();
  latest('GET').success(ok({ items: [plan('created', 'dinner')] }));
  await fetching;
  latest('POST').success(ok(plan('created')));
  await saving;
  expect(store.allPlans).toEqual([plan('created', 'dinner')]);
});

test.each(['update', 'delete'])('a delayed create response preserves a later %s of its already-visible plan', async action => {
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.createNewPlan();
  const creating = vm.submitCreate(body());
  await flushPromises();
  const creation = latest('POST');
  vm.closeCreateDialog();
  initialPlans = [plan('created')];
  await vm.refreshPlans();
  await flushPromises();
  expect(wrapper.findAllComponents({ name: 'PlanCard' })).toHaveLength(1);

  if (action === 'update') {
    vm.editPlan(vm.currentPlans[0]);
    const updating = vm.submitEdit(body('dinner'));
    await flushPromises();
    latest('PATCH', '/meal-plans/created').success(ok(plan('created', 'dinner')));
    await updating;
  } else {
    const deleting = vm.deletePlan('created');
    await flushPromises();
    latest('DELETE', '/meal-plans/created').success(ok(null));
    await deleting;
  }
  creation.success(ok(plan('created')));
  await creating;
  await flushPromises();

  expect(usePlanStore().allPlans).toEqual(action === 'update' ? [plan('created', 'dinner')] : []);
  expect(wrapper.findAllComponents({ name: 'PlanCard' })).toHaveLength(action === 'update' ? 1 : 0);
  expect(vm.error).toBeNull();
  expect(uniMock.showToast).not.toHaveBeenCalled();
});

test('reconciliation keeps independent creates committed during successive list reads', async () => {
  const store = usePlanStore();
  autoRead = false;
  const fetching = store.fetchPlans();
  const first = store.createPlan(body('breakfast'));
  const second = store.createPlan(body('dinner'));
  await flushPromises();
  matching('POST')[0].success(ok(plan('first', 'breakfast')));
  await first;
  latest('GET').success(ok({ items: [] }));
  await flushPromises();
  expect(matching('GET')).toHaveLength(2);
  matching('POST')[1].success(ok(plan('second', 'dinner')));
  await second;
  latest('GET').success(ok({ items: [plan('first', 'breakfast')] }));
  await flushPromises();
  expect(store.allPlans.map(item => item.id)).toEqual(['second', 'first']);
  expect(matching('GET')).toHaveLength(3);
  latest('GET').success(ok({ items: [plan('first', 'breakfast'), plan('second', 'dinner')] }));
  await fetching;
  expect(store.allPlans.map(item => item.id)).toEqual(['first', 'second']);
});

test.each([
  ['success', false], ['failure', false], ['success', true], ['failure', true],
])('a superseded list %s cannot affect a newer read (newer finishes first: %s)', async (outcome, newerFirst) => {
  const store = usePlanStore();
  autoRead = false;
  const first = store.fetchPlans();
  const firstResult = first.catch(error => error);
  await flushPromises();
  const oldRead = latest('GET');
  const second = store.fetchPlans();
  await flushPromises();
  if (newerFirst) {
    latest('GET').success(ok({ items: [plan('current')] }));
    await second;
  }
  oldRead.success(outcome === 'success' ? ok({ items: [plan('old')] }) : failure);
  await firstResult;
  expect(store.error).toBeNull();
  if (!newerFirst) {
    expect(store.loading).toBe(true);
    expect(store.allPlans).toEqual([]);
    latest('GET').success(ok({ items: [plan('current')] }));
    await second;
  }
  expect(store.allPlans.map(item => item.id)).toEqual(['current']);
  expect(store.loading).toBe(false);
});

test('current save failure reports feedback without hiding the list or clearing the draft', async () => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.editPlan(vm.currentPlans[0]);
  await flushPromises();
  const dialog = wrapper.findAllComponents(PlanEditDialog)[0].vm as any;
  Object.assign(dialog.formData, body('dinner'));
  const saving = vm.submitEdit(body('dinner'));
  const rejected = expect(saving).rejects.toThrow('网络开小差了，请稍后再试');
  await flushPromises();
  expect(vm.loading).toBe(false);
  latest('PATCH', '/meal-plans/existing').success(failure);
  await rejected;
  await flushPromises();
  expect(vm.error).toBeNull();
  expect(wrapper.findAllComponents({ name: 'PlanCard' })).toHaveLength(1);
  expect(vm.showEditDialog).toBe(true);
  expect(vm.submitting).toBe(false);
  expect(dialog.formData).toMatchObject(body('dinner'));
  expect(uniMock.showToast).toHaveBeenCalledWith({ title: '网络开小差了，请稍后再试', icon: 'none' });
});

test('a failed deletion reports feedback and releases a queued update', async () => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  const deleting = vm.deletePlan('existing');
  await flushPromises();
  const saving = usePlanStore().updatePlan('existing', body('dinner'));
  await flushPromises();
  expect(matching('PATCH', '/meal-plans/existing')).toHaveLength(0);
  latest('DELETE', '/meal-plans/existing').success(failure);
  await deleting;
  await flushPromises();
  expect(vm.error).toBeNull();
  expect(wrapper.findAllComponents({ name: 'PlanCard' })).toHaveLength(1);
  expect(uniMock.showToast).toHaveBeenCalledWith({ title: '网络开小差了，请稍后再试', icon: 'none' });
  latest('PATCH', '/meal-plans/existing').success(ok(plan('existing', 'dinner')));
  await saving;
  expect(usePlanStore().allPlans[0].mealTime).toBe('dinner');
});

test('an edit queued after a successful deletion fails without restoring the deleted plan', async () => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  const deleting = vm.deletePlan('existing');
  await flushPromises();
  vm.editPlan(vm.currentPlans[0]);
  const saving = vm.submitEdit(body('dinner'));
  const rejected = expect(saving).rejects.toThrow();
  await flushPromises();
  expect(matching('PATCH', '/meal-plans/existing')).toHaveLength(0);
  latest('DELETE', '/meal-plans/existing').success(ok(null));
  await deleting;
  await flushPromises();
  latest('PATCH', '/meal-plans/existing').success({
    statusCode: 404, data: { code: 404, message: '饮食计划不存在' },
  });
  await rejected;
  expect(usePlanStore().allPlans).toEqual([]);
  expect(usePlanStore().error).toBeNull();
  expect(vm.showEditDialog).toBe(true);
  expect(vm.submitting).toBe(false);
  expect(uniMock.showToast).toHaveBeenCalledTimes(1);
});

test('a deletion confirmation from a disposed page cannot send a request', async () => {
  const wrapper = await page();
  let confirm!: (result: { confirm: boolean }) => void;
  uniMock.showModal.mockImplementation(options => { confirm = options.success; });
  const deleting = (wrapper.vm as any).deletePlan('existing');
  wrapper.unmount();
  confirm({ confirm: true });
  await deleting;
  expect(matching('DELETE', '/meal-plans/existing')).toHaveLength(0);
});

test.each(['success', 'failure'])('a hidden page retains deletion %s without obsolete feedback', async outcome => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const deleting = (wrapper.vm as any).deletePlan('existing');
  await flushPromises();
  const request = latest('DELETE', '/meal-plans/existing');
  hidePage();
  await flushPromises();
  expect(wrapper.exists()).toBe(true);
  request.success(outcome === 'success' ? ok(null) : failure);
  await deleting;
  expect(usePlanStore().allPlans.map(item => item.id)).toEqual(outcome === 'success' ? [] : ['existing']);
  expect(usePlanStore().error).toBeNull();
  expect(uniMock.showToast).not.toHaveBeenCalled();
});

test('a deletion confirmation from a hidden page cannot send a request', async () => {
  const wrapper = await page();
  let confirm!: (result: { confirm: boolean }) => void;
  uniMock.showModal.mockImplementation(options => { confirm = options.success; });
  const deleting = (wrapper.vm as any).deletePlan('existing');
  hidePage();
  confirm({ confirm: true });
  await flushPromises();
  latest('DELETE', '/meal-plans/existing')?.success(ok(null));
  await deleting;
  expect(matching('DELETE', '/meal-plans/existing')).toHaveLength(0);
});

test('returning to the page cannot revive an old deletion confirmation, but a new deletion works', async () => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  let confirm!: (result: { confirm: boolean }) => void;
  uniMock.showModal.mockImplementation(options => { confirm = options.success; });
  const oldDeletion = vm.deletePlan('existing');
  const oldConfirm = confirm;
  hidePage();
  showPage();
  oldConfirm({ confirm: true });
  await flushPromises();
  latest('DELETE', '/meal-plans/existing')?.success(ok(null));
  await oldDeletion;
  expect(matching('DELETE', '/meal-plans/existing')).toHaveLength(0);

  const currentDeletion = vm.deletePlan('existing');
  confirm({ confirm: true });
  await flushPromises();
  expect(matching('DELETE', '/meal-plans/existing')).toHaveLength(1);
  latest('DELETE', '/meal-plans/existing').success(ok(null));
  await currentDeletion;
  expect(usePlanStore().allPlans).toEqual([]);
});

test.each(['success', 'failure'])('a mark-eaten %s from an earlier visible period has no late feedback', async outcome => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  const completing = vm.executePlan(outcome === 'success' ? 'existing' : 'missing');
  hidePage();
  showPage();
  await completing;
  expect(uniMock.showToast).not.toHaveBeenCalled();
  expect(usePlanStore().historyPlans.some(item => item.id === 'existing')).toBe(outcome === 'success');
});

test('hiding an unchanged or edited meal preserves the editable draft', async () => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.editPlan(vm.currentPlans[0]);
  await flushPromises();
  const dialog = wrapper.findAllComponents(PlanEditDialog)[0].vm as any;
  Object.assign(dialog.formData, body('dinner'));
  hidePage();
  await flushPromises();
  showPage();
  expect(vm.showEditDialog).toBe(true);
  expect(vm.selectedPlan.id).toBe('existing');
  expect(dialog.formData).toMatchObject(body('dinner'));
  expect(vm.submitting).toBe(false);
});

test.each([
  ['success', false], ['failure', false], ['success', true], ['failure', true],
])('a hidden save %s keeps its pending lock until settled and allows later work (returned before settlement: %s)', async (outcome, returnedFirst) => {
  initialPlans = [plan('existing')];
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.editPlan(vm.currentPlans[0]);
  await flushPromises();
  const dialog = wrapper.findAllComponents(PlanEditDialog)[0].vm as any;
  Object.assign(dialog.formData, body('dinner'));
  const saving = vm.submitEdit(body('dinner')).catch((err: unknown) => err);
  await flushPromises();
  const request = latest('PATCH', '/meal-plans/existing');
  hidePage();
  await flushPromises();
  if (returnedFirst) showPage();
  expect(vm.submitting).toBe(true);
  expect(vm.showEditDialog).toBe(true);
  expect(dialog.formData).toMatchObject(body('dinner'));
  await vm.submitEdit(body('breakfast'));
  expect(matching('PATCH', '/meal-plans/existing')).toHaveLength(1);

  request.success(outcome === 'success' ? ok(plan('existing', 'dinner')) : failure);
  await saving;
  await flushPromises();
  expect(vm.submitting).toBe(false);
  expect(uniMock.showToast).not.toHaveBeenCalled();
  if (outcome === 'failure') {
    expect(vm.showEditDialog).toBe(true);
    expect(dialog.formData).toMatchObject(body('dinner'));
  }
  if (!returnedFirst) showPage();
  if (outcome === 'success') vm.editPlan(vm.currentPlans[0]);
  const nextSave = vm.submitEdit(body('breakfast'));
  await flushPromises();
  expect(vm.submitting).toBe(true);
  expect(matching('PATCH', '/meal-plans/existing')).toHaveLength(2);
  latest('PATCH', '/meal-plans/existing').success(ok(plan('existing', 'breakfast')));
  await nextSave;
  expect(vm.submitting).toBe(false);
  expect(vm.showEditDialog).toBe(false);
  expect(usePlanStore().allPlans[0].mealTime).toBe('breakfast');
});

test('a current list failure remains a list error and can be retried', async () => {
  const store = usePlanStore();
  autoRead = false;
  const fetching = store.fetchPlans();
  const rejected = expect(fetching).rejects.toThrow('网络开小差了，请稍后再试');
  await flushPromises();
  latest('GET').success(failure);
  await rejected;
  expect(store.error).toBe('网络开小差了，请稍后再试');
  expect(store.loading).toBe(false);
  const retry = store.fetchPlans();
  await flushPromises();
  latest('GET').success(ok({ items: [plan('existing')] }));
  await retry;
  expect(store.error).toBeNull();
  expect(store.allPlans.map(item => item.id)).toEqual(['existing']);
});

test('account changes cancel unsent writes without blocking the new account queue', async () => {
  const store = usePlanStore();
  store.allPlans = [plan('existing')];
  const first = store.updatePlan('existing', body('breakfast')).catch(error => error);
  const queued = store.updatePlan('existing', body('dinner')).catch(error => error);
  const deleting = store.removePlan('existing').catch(error => error);
  await flushPromises();
  const oldRequest = latest('PATCH', '/meal-plans/existing');
  expect(matching('PATCH', '/meal-plans/existing')).toHaveLength(1);
  const user = useUserStore();
  user.logoutAction();
  user.token = 'B-token';
  user.userInfo = { id: 'B', nickname: 'B' } as any;
  const current = store.updatePlan('existing', body('lunch'));
  await flushPromises();
  const currentRequest = latest('PATCH', '/meal-plans/existing');
  expect(currentRequest).not.toBe(oldRequest);
  expect(currentRequest.header.Authorization).toBe('Bearer B-token');
  currentRequest.success(ok({ ...plan('existing'), userId: 'B' }));
  await current;
  oldRequest.success(ok(plan('existing', 'breakfast')));
  const outcomes = await Promise.all([first, queued, deleting]);
  expect(outcomes.every(result => result instanceof Error)).toBe(true);
  expect(matching('PATCH', '/meal-plans/existing')).toHaveLength(2);
  expect(matching('DELETE', '/meal-plans/existing')).toHaveLength(0);
  expect(store.allPlans).toEqual([{ ...plan('existing'), userId: 'B' }]);
  expect(store.error).toBeNull();
});

test.each(['success', 'failure'])('a disposed page preserves same-account write %s without UI feedback', async outcome => {
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.createNewPlan();
  const saving = vm.submitCreate(body());
  await flushPromises();
  wrapper.unmount();
  latest('POST').success(outcome === 'success' ? ok(plan('created')) : failure);
  await saving;
  expect(usePlanStore().allPlans.map(item => item.id)).toEqual(outcome === 'success' ? ['created'] : []);
  expect(usePlanStore().error).toBeNull();
  expect(uniMock.showToast).not.toHaveBeenCalled();
});
