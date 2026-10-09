import { flushPromises, shallowMount } from '@vue/test-utils';
import type { DOMWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import ChatPage from '@/pages/ai-chat/index.vue';
import InputBar from '@/pages/ai-chat/components/InputBar.vue';
import PlanningPage from '@/pages/planning/index.vue';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';
import { useChatStore } from '@/store/modules/use-chat-store';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { useUserStore } from '@/store/modules/use-user-store';
import { createAISession, deleteAISession, getAISuggestions, streamAIChat } from '@/api/modules/ai';
import { createMealPlan, getMealPlans, updateMealPlan } from '@/api/modules/meal-plan';
import { getDishById, getDishes } from '@/api/modules/dish';
import { getCanteenList } from '@/api/modules/canteen';

jest.mock('@dcloudio/uni-app', () => ({
  onHide: jest.fn(), onBackPress: jest.fn(), onPullDownRefresh: jest.fn(),
}));
jest.mock('@/api/modules/ai');
jest.mock('@/api/modules/meal-plan');
jest.mock('@/api/modules/dish');
jest.mock('@/api/modules/canteen');

const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<any>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
};
const ok = (data: any) => ({ code: 200, data });
const session = (sessionId = 'A-session', welcomeMessage?: string) => ok({ sessionId, welcomeMessage });
const plan = (id = 'saved-plan') => ({
  id, userId: 'A', startDate: '2099-10-05', endDate: '2099-10-05',
  mealTime: 'lunch', dishes: ['dish'], createdAt: '2026-10-05T00:00:00.000Z',
});
const dish = (id = 'dish', price = 8) => ({ id, name: id, price, averageRating: 0, images: [] });
const storage = new Map<string, any>();
const wrappers: any[] = [];
const pageErrors = jest.fn();
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: any) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  showToast: jest.fn(), showModal: jest.fn(), showLoading: jest.fn(), hideLoading: jest.fn(),
  $on: jest.fn(), $off: jest.fn(), stopPullDownRefresh: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  storage.clear();
  storage.set('token', 'A-token');
  storage.set('userInfo', JSON.stringify({ id: 'A', nickname: 'A' }));
  (global as any).uni = uniMock;
  setActivePinia(createPinia());
  (createAISession as jest.Mock).mockResolvedValue(session());
  (deleteAISession as jest.Mock).mockResolvedValue(ok(null));
  (getAISuggestions as jest.Mock).mockResolvedValue(ok({ suggestions: [] }));
  (streamAIChat as jest.Mock).mockReturnValue({ close: jest.fn() });
  (getMealPlans as jest.Mock).mockResolvedValue(ok({ items: [] }));
  (getDishById as jest.Mock).mockImplementation(id => Promise.resolve(ok(dish(id))));
  (getDishes as jest.Mock).mockResolvedValue(ok({ items: [], meta: { page: 1, totalPages: 1 } }));
  (getCanteenList as jest.Mock).mockResolvedValue(ok({ items: [], meta: { page: 1, totalPages: 1 } }));
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function chatPage() {
  const wrapper = shallowMount(ChatPage, {
    global: {
      config: { errorHandler: pageErrors },
      stubs: {
        InputBar: false,
        MarkdownText: { props: ['content'], template: '<span>{{ content }}</span>' },
        'page-container': true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

function planningPage(editable = false, cards = false) {
  const wrapper = shallowMount(PlanningPage, {
    global: {
      config: { errorHandler: pageErrors },
      stubs: { PlanCard: !cards, PlanEditDialog: !editable, 'page-container': true, picker: true, 'uni-icons': true },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

function expectBlankChat(wrapper: any) {
  expect(wrapper.findComponent({ name: 'AIChatSkeleton' }).exists()).toBe(false);
  expect(wrapper.find('.chat-state').exists()).toBe(false);
  expect(wrapper.findAll('.chat-message').length).toBe(0);
  expect(wrapper.find('.ai-chat-toolbar').exists()).toBe(true);
  expect(wrapper.findComponent(InputBar).exists()).toBe(true);
}

function expectBlankPlans(wrapper: any) {
  expect(wrapper.findComponent({ name: 'PlanningSkeleton' }).exists()).toBe(false);
  expect(wrapper.text()).not.toMatch(/暂无当前规划|暂无历史规划|创建第一个规划/);
  expect(wrapper.findAllComponents({ name: 'PlanCard' }).length).toBe(0);
  expect(wrapper.findAll('[role="tab"]').length).toBe(2);
  expect(wrapper.findAll('[role="tab"]').map((tab: DOMWrapper<Element>) => tab.text())).toEqual(['当前规划', '历史规划']);
  expect(wrapper.find('[aria-label="新建规划"]').exists()).toBe(true);
}

describe('chat loading lifecycle', () => {
  test.each(['init', 'resetChat', 'history'])('%s completes and accepts a send before optional suggestions return', async action => {
    const wrapper = chatPage();
    await flushPromises();
    const suggestions = deferred();
    (getAISuggestions as jest.Mock).mockReturnValueOnce(suggestions.promise);
    const vm = wrapper.vm as any;
    let completed = false;
    let pending: Promise<any>;
    if (action === 'history') {
      useChatStore().historyEntries = [{
        sessionId: 'saved', scene: 'general_chat', updatedAt: 1,
        messages: [{ id: 1, type: 'ai', timestamp: 1, content: [{ type: 'text', text: '历史欢迎语' }] }],
      }];
      vm.openHistory();
      pending = vm.handleLoadHistory('saved');
    } else pending = vm[action]();
    const settled = pending.then(() => { completed = true; });
    await flushPromises();
    expect(completed).toBe(true);
    expect(vm.isInitializing).toBe(false);
    if (action === 'history') expect(vm.showHistory).toBe(false);
    await wrapper.findComponent(InputBar).get('textarea').setValue('立即发送');
    await wrapper.get('[aria-label="发送消息"]').trigger('click');
    await flushPromises();
    expect(streamAIChat).toHaveBeenCalledTimes(1);
    expect(useChatStore().messages.some(message => message.type === 'user')).toBe(true);
    expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('');
    suggestions.resolve(ok({ suggestions: ['旧建议'] }));
    await settled;
    await flushPromises();
    expect(vm.suggestions).toEqual([]);
  });

  test('initial data stays blank while composer survives, then returned text appears before suggestions settle', async () => {
    const creation = deferred();
    const suggestions = deferred();
    (createAISession as jest.Mock).mockReturnValueOnce(creation.promise);
    (getAISuggestions as jest.Mock).mockReturnValueOnce(suggestions.promise);
    const wrapper = chatPage();
    const textarea = wrapper.findComponent(InputBar).get('textarea');
    await textarea.setValue('尚未发送的问题');
    expectBlankChat(wrapper);
    creation.resolve(session('ready', '欢迎来聊聊午餐'));
    await flushPromises();
    expect(wrapper.text()).toContain('欢迎来聊聊午餐');
    expect(wrapper.findComponent(InputBar).get('textarea').element).toBe(textarea.element);
    expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('尚未发送的问题');
    suggestions.resolve(ok({ suggestions: [] }));
    await flushPromises();
  });

  test('a successful empty session shows the welcome state without waiting for optional suggestions', async () => {
    const suggestions = deferred();
    (getAISuggestions as jest.Mock).mockReturnValueOnce(suggestions.promise);
    const wrapper = chatPage();
    await flushPromises();
    expect(wrapper.text()).toContain('今天想吃什么？');
    expect(wrapper.findComponent({ name: 'AIChatSkeleton' }).exists()).toBe(false);
    suggestions.resolve(ok({ suggestions: [] }));
    await flushPromises();
  });

  test('failed initialization is retryable, keeps the draft, and does not show welcome during retry', async () => {
    (createAISession as jest.Mock).mockRejectedValueOnce(new Error('请求超时'));
    const wrapper = chatPage();
    await wrapper.findComponent(InputBar).get('textarea').setValue('保留问题');
    await flushPromises();
    expect(wrapper.text()).toContain('重试连接');
    expect(wrapper.text()).not.toContain('今天想吃什么？');
    const retry = deferred();
    (createAISession as jest.Mock).mockReturnValueOnce(retry.promise);
    await wrapper.get('.chat-button-primary').trigger('click');
    expectBlankChat(wrapper);
    expect(wrapper.findComponent(InputBar).props('modelValue')).toBe('保留问题');
    retry.resolve(session('retry'));
    await flushPromises();
    expect(wrapper.text()).toContain('今天想吃什么？');
    expect(wrapper.text()).not.toContain('重试连接');
    expect(createAISession).toHaveBeenCalledTimes(2);
  });

  test('cached history remains visible while its opening suggestions refresh and fail', async () => {
    const store = useChatStore();
    store.historyEntries = [{
      sessionId: 'selected', scene: 'general_chat', updatedAt: 1,
      messages: [{ id: 1, type: 'ai', timestamp: 1, content: [{ type: 'text', text: '已选对话' }] }],
    }];
    store.loadSessionFromHistory('selected');
    const suggestions = deferred();
    (getAISuggestions as jest.Mock).mockReturnValueOnce(suggestions.promise);
    const wrapper = chatPage();
    await flushPromises();
    expect(wrapper.text()).toContain('已选对话');
    expect(store.sessionId).toBe('selected');
    expect(createAISession).not.toHaveBeenCalled();
    suggestions.reject(new Error('建议读取失败'));
    await flushPromises();
    expect(wrapper.text()).toContain('已选对话');
    expect(wrapper.text()).not.toContain('重试连接');
  });

  test('history selection is visible immediately and an obsolete initialization cannot replace it', async () => {
    const creation = deferred();
    (createAISession as jest.Mock).mockReturnValueOnce(creation.promise);
    const wrapper = chatPage();
    useChatStore().historyEntries = [{
      sessionId: 'saved', scene: 'general_chat', updatedAt: 1,
      messages: [{ id: 1, type: 'ai', timestamp: 1, content: [{ type: 'text', text: '历史欢迎语' }] }],
    }];
    const suggestions = deferred();
    (getAISuggestions as jest.Mock).mockReturnValueOnce(suggestions.promise);
    const selected = (wrapper.vm as any).loadHistorySession('saved');
    await nextTick();
    expect(wrapper.text()).toContain('历史欢迎语');
    creation.resolve(session('obsolete', '过时欢迎语'));
    await flushPromises();
    expect(wrapper.text()).not.toContain('过时欢迎语');
    expect(useChatStore().sessionId).toBe('saved');
    suggestions.resolve(ok({ suggestions: [] }));
    expect(await selected).toBe(true);
  });

  test('new-session initialization withholds the prior welcome state and exposes failure', async () => {
    const wrapper = chatPage();
    await flushPromises();
    expect(wrapper.text()).toContain('今天想吃什么？');
    const creation = deferred();
    (createAISession as jest.Mock).mockReturnValueOnce(creation.promise);
    const pending = (wrapper.vm as any).resetChat();
    await nextTick();
    expectBlankChat(wrapper);
    creation.reject(new Error('会话创建失败'));
    await pending;
    await nextTick();
    expect(wrapper.text()).toContain('重试连接');
    expect(wrapper.text()).not.toContain('今天想吃什么？');
  });

  test('account changes discard the previous connection error and withhold the next account data', async () => {
    (createAISession as jest.Mock).mockRejectedValueOnce(new Error('A 连接失败'));
    const wrapper = chatPage();
    await flushPromises();
    expect(wrapper.text()).toContain('重试连接');
    const user = useUserStore();
    user.logoutAction();
    user.userInfo = { id: 'B' } as any;
    user.token = 'B-token';
    await nextTick();
    expectBlankChat(wrapper);
    const creation = deferred();
    (createAISession as jest.Mock).mockReturnValueOnce(creation.promise);
    const pending = (wrapper.vm as any).init();
    expectBlankChat(wrapper);
    creation.resolve(session('B-session'));
    await pending;
    await nextTick();
    expect(wrapper.text()).toContain('今天想吃什么？');
    expect(useChatStore().sessionId).toBe('B-session');
  });

  test('failed replacement after deleting the current session is an initialization error, not empty success', async () => {
    const wrapper = chatPage();
    await flushPromises();
    (createAISession as jest.Mock).mockRejectedValueOnce(new Error('新会话连接失败'));
    await (wrapper.vm as any).deleteSession('A-session');
    await nextTick();
    expect(wrapper.text()).toContain('重试连接');
    expect(wrapper.text()).not.toContain('今天想吃什么？');
    expect(wrapper.findComponent(InputBar).exists()).toBe(true);
  });

  test('a failed deletion retains the successful empty current conversation', async () => {
    const wrapper = chatPage();
    await flushPromises();
    (deleteAISession as jest.Mock).mockRejectedValueOnce(new Error('删除失败'));
    expect(await (wrapper.vm as any).deleteSession('A-session')).toBe(false);
    await nextTick();
    expect(useChatStore().sessionId).toBe('A-session');
    expect(wrapper.text()).toContain('今天想吃什么？');
    expect(wrapper.text()).not.toContain('重试连接');
  });
});

describe('planning loading lifecycle', () => {
  test('first read leaves only fixed controls until a successful empty result', async () => {
    const read = deferred();
    (getMealPlans as jest.Mock).mockReturnValueOnce(read.promise);
    const wrapper = planningPage();
    expectBlankPlans(wrapper);
    await nextTick();
    expectBlankPlans(wrapper);
    expect(usePlanStore().initialized).toBe(false);
    read.resolve(ok({ items: [] }));
    await flushPromises();
    expect(wrapper.text()).toContain('暂无当前规划');
    expect(usePlanStore().initialized).toBe(true);
    await wrapper.findAll('[role="tab"]')[1].trigger('tap');
    expect(wrapper.text()).toContain('暂无历史规划');
  });

  test('an initial read failure shows retry instead of an empty state and retry preserves the frame', async () => {
    (getMealPlans as jest.Mock).mockRejectedValueOnce(new Error('规划读取超时'));
    const wrapper = planningPage();
    await flushPromises();
    expect(wrapper.text()).toContain('规划读取超时');
    expect(wrapper.text()).not.toContain('暂无当前规划');
    expect(usePlanStore().initialized).toBe(false);
    expect(pageErrors).not.toHaveBeenCalled();
    const read = deferred();
    (getMealPlans as jest.Mock).mockReturnValueOnce(read.promise);
    const retry = wrapper.findAll('button').find(button => button.text() === '重试')!;
    await retry.trigger('tap');
    expectBlankPlans(wrapper);
    read.resolve(ok({ items: [plan()] }));
    await flushPromises();
    expect(wrapper.findAllComponents({ name: 'PlanCard' }).length).toBe(1);
    expect(wrapper.text()).not.toContain('重试');
  });

  test('a create draft stays mounted when the first list arrives', async () => {
    const read = deferred();
    (getMealPlans as jest.Mock).mockReturnValueOnce(read.promise);
    const wrapper = planningPage(true);
    await wrapper.get('[aria-label="新建规划"]').trigger('tap');
    await flushPromises();
    expect(wrapper.findAllComponents(PlanEditDialog).length).toBe(2);
    const editor = wrapper.findAllComponents(PlanEditDialog)[1];
    const vm = editor.vm as any;
    vm.formData.mealTime = 'dinner';
    read.resolve(ok({ items: [plan()] }));
    await flushPromises();
    expect(wrapper.findAllComponents(PlanEditDialog)[1].element === editor.element).toBe(true);
    expect(vm.formData.mealTime).toBe('dinner');
    expect((wrapper.vm as any).showCreateDialog).toBe(true);
  });

  test('cached plans and an edit draft remain visible through refresh failure', async () => {
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [plan()] }));
    const store = usePlanStore();
    await store.fetchPlans();
    const read = deferred();
    (getMealPlans as jest.Mock).mockReturnValueOnce(read.promise);
    const wrapper = planningPage(true);
    await flushPromises();
    expect(wrapper.findAllComponents({ name: 'PlanCard' }).length).toBe(1);
    (wrapper.vm as any).editPlan(store.currentPlans[0]);
    await nextTick();
    const editor = wrapper.findAllComponents(PlanEditDialog)[0];
    const selected = store.selectedPlan;
    (editor.vm as any).formData.mealTime = 'dinner';
    read.reject(new Error('刷新失败'));
    await flushPromises();
    expect(wrapper.findAllComponents({ name: 'PlanCard' }).length).toBe(1);
    expect(wrapper.text()).toContain('刷新失败');
    expect(wrapper.text()).toContain('重试');
    expect(store.selectedPlan?.id).toBe(selected?.id);
    expect(wrapper.findAllComponents(PlanEditDialog)[0].element === editor.element).toBe(true);
    expect((editor.vm as any).formData.mealTime).toBe('dinner');
    expect((wrapper.vm as any).showEditDialog).toBe(true);
    expect(pageErrors).not.toHaveBeenCalled();
  });

  test('a cached successful empty list stays an empty result during refresh', async () => {
    const store = usePlanStore();
    await store.fetchPlans();
    const read = deferred();
    (getMealPlans as jest.Mock).mockReturnValueOnce(read.promise);
    const wrapper = planningPage();
    expect(wrapper.text()).toContain('暂无当前规划');
    expect(wrapper.findComponent({ name: 'PlanningSkeleton' }).exists()).toBe(false);
    read.resolve(ok({ items: [] }));
    await flushPromises();
  });

  test.each(['success', 'failure'])('a late previous-account %s cannot establish readiness or affect the next read', async outcome => {
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [plan()] }));
    const wrapper = planningPage();
    await flushPromises();
    const old = deferred();
    (getMealPlans as jest.Mock).mockReturnValueOnce(old.promise);
    const pendingOld = (wrapper.vm as any).refreshPlans();
    const user = useUserStore();
    user.logoutAction();
    user.userInfo = { id: 'B' } as any;
    user.token = 'B-token';
    await nextTick();
    expectBlankPlans(wrapper);
    const current = deferred();
    (getMealPlans as jest.Mock).mockReturnValueOnce(current.promise);
    const pendingCurrent = (wrapper.vm as any).refreshPlans();
    if (outcome === 'success') old.resolve(ok({ items: [plan('old-plan')] }));
    else old.reject(new Error('A 读取失败'));
    await pendingOld;
    await nextTick();
    expect(usePlanStore().initialized).toBe(false);
    expect(usePlanStore().loading).toBe(true);
    expectBlankPlans(wrapper);
    current.resolve(ok({ items: [] }));
    await pendingCurrent;
    await nextTick();
    expect(usePlanStore().initialized).toBe(true);
    expect(wrapper.text()).toContain('暂无当前规划');
    expect(wrapper.text()).not.toContain('A 读取失败');
  });

  test('a populated first read does not publish an editable plan or totals until every dish returns', async () => {
    const second = deferred();
    const complete = { ...plan(), dishes: ['first', 'second'] };
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [complete] }));
    (getDishById as jest.Mock)
      .mockResolvedValueOnce(ok(dish('first', 7)))
      .mockReturnValueOnce(second.promise);
    const wrapper = planningPage(true, true);
    await flushPromises();
    expectBlankPlans(wrapper);
    expect(wrapper.find('[aria-label="编辑规划"]').exists()).toBe(false);
    expect(wrapper.find('.meal-card-total').exists()).toBe(false);
    expect(updateMealPlan).not.toHaveBeenCalled();
    expect(usePlanStore().selectedPlan).toBeNull();
    second.resolve(ok(dish('second', 8)));
    await flushPromises();
    expect(wrapper.findAll('.meal-card-dish').length).toBe(2);
    expect(wrapper.text()).toContain('所列单价合计 ¥15.00');
    await wrapper.get('[aria-label="编辑规划"]').trigger('tap');
    const editor = wrapper.findAllComponents(PlanEditDialog)[0].vm as any;
    expect(editor.formData.dishes).toEqual(['first', 'second']);
    (updateMealPlan as jest.Mock).mockResolvedValueOnce(ok({ ...complete, mealTime: 'dinner' }));
    editor.formData.mealTime = 'dinner';
    editor.handleSubmit();
    await flushPromises();
    expect(updateMealPlan).toHaveBeenCalledWith(expect.objectContaining({ dishes: ['first', 'second'] }), complete.id);
  });

  test.each(['network failure', 'deleted dish'])('a required lookup %s fails initialization without losing authoritative IDs, then retries the complete list', async outcome => {
    const complete = { ...plan(), dishes: ['first', 'second'] };
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [complete] }));
    (getDishById as jest.Mock)
      .mockResolvedValueOnce(ok(dish('first')))
      .mockRejectedValueOnce(new Error(outcome === 'deleted dish' ? '菜品不存在' : '菜品读取超时'));
    const wrapper = planningPage(true, true);
    await flushPromises();
    expect(usePlanStore().initialized).toBe(false);
    expect(wrapper.findAllComponents({ name: 'PlanCard' }).length).toBe(0);
    expect(wrapper.find('[aria-label="编辑规划"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('重试');
    expect(wrapper.text()).not.toContain('暂无当前规划');
    const retried = outcome === 'deleted dish' ? { ...complete, dishes: ['first'] } : complete;
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [retried] }));
    await wrapper.findAll('button').find(button => button.text() === '重试')!.trigger('tap');
    await flushPromises();
    expect(usePlanStore().initialized).toBe(true);
    expect(usePlanStore().currentPlans[0].dishes.map(item => item.id)).toEqual(retried.dishes);
    await wrapper.get('[aria-label="编辑规划"]').trigger('tap');
    expect((wrapper.findAllComponents(PlanEditDialog)[0].vm as any).formData.dishes).toEqual(retried.dishes);
    expect(updateMealPlan).not.toHaveBeenCalled();
  });

  test('a failed refresh lookup retains the complete cached plan, prices and editable draft', async () => {
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [plan()] }));
    const wrapper = planningPage(true, true);
    await flushPromises();
    const store = usePlanStore();
    await wrapper.get('[aria-label="编辑规划"]').trigger('tap');
    const editor = wrapper.findAllComponents(PlanEditDialog)[0];
    (editor.vm as any).formData.mealTime = 'dinner';
    const unavailable = deferred();
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [{ ...plan(), dishes: ['dish', 'new-dish'] }] }));
    (getDishById as jest.Mock)
      .mockResolvedValueOnce(ok(dish('dish', 99)))
      .mockReturnValueOnce(unavailable.promise);
    const pending = (wrapper.vm as any).refreshPlans();
    await flushPromises();
    expect(store.currentPlans[0].dishes.map(item => item.id)).toEqual(['dish']);
    expect(wrapper.text()).toContain('所列单价合计 ¥8.00');
    unavailable.reject(new Error('菜品资料读取失败'));
    await pending;
    await nextTick();
    expect(store.currentPlans[0].dishes.map(item => item.id)).toEqual(['dish']);
    expect(wrapper.text()).toContain('所列单价合计 ¥8.00');
    expect(wrapper.text()).toContain('菜品资料读取失败');
    expect((editor.vm as any).formData.mealTime).toBe('dinner');
    expect(wrapper.findAllComponents(PlanEditDialog)[0].element === editor.element).toBe(true);
  });

  test.each(['success', 'failure'])('a list lookup ending in %s after a committed write re-reads the authoritative list', async outcome => {
    const original = plan();
    const updated = { ...original, mealTime: 'dinner' };
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [original] }));
    const store = usePlanStore();
    await store.fetchPlans();
    const lookup = deferred();
    (getMealPlans as jest.Mock)
      .mockResolvedValueOnce(ok({ items: [original] }))
      .mockResolvedValueOnce(ok({ items: [updated] }));
    (getDishById as jest.Mock).mockReturnValueOnce(lookup.promise);
    const pending = store.fetchPlans();
    await flushPromises();
    (updateMealPlan as jest.Mock).mockResolvedValueOnce(ok(updated));
    await store.updatePlan(original.id, { ...updated, dishes: [...updated.dishes] } as any);
    if (outcome === 'success') lookup.resolve(ok(dish('dish', 1)));
    else lookup.reject(new Error('旧菜品读取失败'));
    await pending;
    expect(getMealPlans).toHaveBeenCalledTimes(3);
    expect(store.currentPlans[0].mealTime).toBe('dinner');
    expect(store.currentPlans[0].dishes[0].price).toBe(8);
    expect(store.error).toBeNull();
  });

  test('a superseded detail response cannot replace the newer complete plan prices', async () => {
    const lookup = deferred();
    (getMealPlans as jest.Mock).mockResolvedValue(ok({ items: [plan()] }));
    (getDishById as jest.Mock)
      .mockReturnValueOnce(lookup.promise)
      .mockResolvedValueOnce(ok(dish('dish', 20)));
    const store = usePlanStore();
    const old = store.fetchPlans();
    await flushPromises();
    await store.fetchPlans();
    lookup.resolve(ok(dish('dish', 1)));
    await old;
    expect(store.currentPlans[0].dishes[0].price).toBe(20);
  });

  test.each(['create', 'update'])('committed %s with failed readback stays accepted but cannot expose partial editable dishes or totals', async action => {
    const written = { ...plan(action === 'create' ? 'created-plan' : 'saved-plan'), dishes: ['missing'] };
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: action === 'create' ? [] : [plan()] }));
    const wrapper = planningPage(true, true);
    await flushPromises();
    const vm = wrapper.vm as any;
    const store = usePlanStore();
    const payload = { startDate: written.startDate, endDate: written.endDate, mealTime: written.mealTime, dishes: ['missing'] };
    (getDishById as jest.Mock).mockRejectedValueOnce(new Error('菜品资料读取失败'));
    if (action === 'create') {
      (createMealPlan as jest.Mock).mockResolvedValueOnce(ok(written));
      vm.createNewPlan();
      await vm.submitCreate(payload);
      expect(vm.showCreateDialog).toBe(false);
      expect(createMealPlan).toHaveBeenCalledTimes(1);
    } else {
      (updateMealPlan as jest.Mock).mockResolvedValueOnce(ok(written));
      vm.editPlan(store.currentPlans[0]);
      await vm.submitEdit(payload);
      expect(vm.showEditDialog).toBe(false);
      expect(updateMealPlan).toHaveBeenCalledTimes(1);
    }
    await nextTick();
    expect(store.allPlans[0].dishes).toEqual(['missing']);
    expect(store.currentPlans[0].dishesReady).toBe(false);
    expect(wrapper.find('.meal-card-total').exists()).toBe(false);
    expect(wrapper.get('[aria-label="编辑规划"]').attributes('disabled')).toBeDefined();
    const selectedIds = store.selectedPlan?.dishes.map(item => item.id) || [];
    await wrapper.get('[aria-label="编辑规划"]').trigger('tap');
    expect(vm.showEditDialog).toBe(false);
    expect(store.selectedPlan?.dishes.map(item => item.id) || []).toEqual(selectedIds);
    expect(wrapper.text()).toContain('重试');
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [written] }));
    await wrapper.findAll('button').find(button => button.text() === '重试')!.trigger('tap');
    await flushPromises();
    expect(store.currentPlans[0].dishesReady).toBe(true);
    expect(wrapper.text()).toContain('所列单价合计 ¥8.00');
    await wrapper.get('[aria-label="编辑规划"]').trigger('tap');
    expect((wrapper.findAllComponents(PlanEditDialog)[0].vm as any).formData.dishes).toEqual(['missing']);
  });

  test('authoritative recovery clears a committed write readback error that arrived while the read was pending', async () => {
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [plan()] }));
    const store = usePlanStore();
    await store.fetchPlans();
    const written = { ...plan(), dishes: ['written-dish'] };
    const readback = deferred();
    const recovery = deferred();
    (updateMealPlan as jest.Mock).mockResolvedValueOnce(ok(written));
    (getDishById as jest.Mock)
      .mockReturnValueOnce(readback.promise)
      .mockReturnValueOnce(recovery.promise);
    const saving = store.updatePlan(written.id, written as any);
    await flushPromises();
    (getMealPlans as jest.Mock).mockResolvedValueOnce(ok({ items: [written] }));
    const refreshing = store.fetchPlans();
    await flushPromises();
    readback.reject(new Error('保存后的菜品读取失败'));
    await saving;
    expect(store.error).toContain('规划已保存');
    expect(store.currentPlans[0].dishesReady).toBe(false);
    recovery.resolve(ok(dish('written-dish')));
    await refreshing;
    expect(store.error).toBeNull();
    expect(store.currentPlans[0].dishesReady).toBe(true);
    expect(store.currentPlans[0].dishes.map(item => item.id)).toEqual(['written-dish']);
    expect(updateMealPlan).toHaveBeenCalledTimes(1);
  });
});
