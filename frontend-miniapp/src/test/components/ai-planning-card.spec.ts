import { mount, shallowMount } from '@vue/test-utils';
import { ref } from 'vue';
import PlanningCard from '@/pages/ai-chat/components/PlanningCard.vue';
import ChatPage from '@/pages/ai-chat/index.vue';
import { useChat } from '@/pages/ai-chat/composables/use-chat';

jest.mock('@/pages/ai-chat/composables/use-chat', () => ({ useChat: jest.fn() }));

const makePlan = () =>
  ({
    summary: '均衡搭配蔬菜与蛋白质',
    previewData: {
      startDate: '2099-10-03',
      endDate: '2099-10-06',
      mealTime: 'lunch',
      dishes: [{ id: 'rice', name: '香菇鸡肉饭', price: 12, images: [], canteenName: '紫荆园' }],
    },
  }) as any;
const toggle = (wrapper: any) => wrapper.get('button[aria-expanded]');
const apply = (wrapper: any) =>
  wrapper.get('.planning-card-apply');

test('planning starts collapsed with useful context and reveals details only on explicit expansion', async () => {
  const wrapper = mount(PlanningCard, { props: { plan: makePlan() } });
  expect(toggle(wrapper).attributes('aria-expanded')).toBe('false');
  expect(toggle(wrapper).get('image, img').attributes('src')).toBe('/static/icons/chevron-down.png');
  expect(wrapper.text()).toContain('午餐规划建议');
  expect(wrapper.text()).toContain('10月03日 — 10月06日');
  expect(wrapper.text()).not.toContain('均衡搭配蔬菜与蛋白质');
  expect(wrapper.text()).not.toContain('香菇鸡肉饭');
  await toggle(wrapper).trigger('click');
  expect(toggle(wrapper).get('image, img').attributes('src')).toBe('/static/icons/chevron-up.png');
  expect(wrapper.text()).toContain('香菇鸡肉饭');
  expect(wrapper.emitted('apply')).toBeUndefined();
  wrapper.unmount();
});

test('normalized uni key events activate once on release and reset a held key on blur', async () => {
  const wrapper = mount(PlanningCard, { props: { plan: makePlan() } });
  await toggle(wrapper).trigger('click');
  const control = toggle(wrapper);
  expect(control.attributes('role')).toBe('button');
  expect(control.attributes('tabindex')).toBe('0');
  for (const key of ['Enter', ' ']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    control.element.dispatchEvent(event);
    await wrapper.vm.$nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(control.attributes('aria-expanded')).toBe('true');
    await control.trigger('keydown', { key, code: key === ' ' ? 'Space' : 'Enter' });
    expect(control.attributes('aria-expanded')).toBe('true');
    await control.trigger('keyup', { key });
    expect(control.attributes('aria-expanded')).toBe('false');
    await control.trigger('click');
    expect(control.attributes('aria-expanded')).toBe('true');
  }
  await control.trigger('keydown', { key: 'Enter' });
  await control.trigger('blur');
  await control.trigger('keyup', { key: 'Enter' });
  expect(control.attributes('aria-expanded')).toBe('true');
  await control.trigger('keydown', { key: 'ArrowDown' });
  expect(control.attributes('aria-expanded')).toBe('true');
  expect(wrapper.emitted('apply')).toBeUndefined();
  expect(wrapper.emitted('discard')).toBeUndefined();
  wrapper.unmount();
});

test('collapse hides details reversibly without emitting or mutating the plan', async () => {
  const plan = makePlan();
  const before = JSON.stringify(plan);
  const wrapper = mount(PlanningCard, { props: { plan } });
  await toggle(wrapper).trigger('click');
  expect(toggle(wrapper).attributes('aria-expanded')).toBe('true');
  await toggle(wrapper).trigger('click');
  expect(wrapper.text()).toContain('10月03日 — 10月06日');
  expect(wrapper.text()).toContain('午餐');
  expect(wrapper.text()).not.toContain(plan.summary);
  expect(wrapper.text()).not.toContain('香菇鸡肉饭');
  expect(wrapper.text()).not.toContain('总价');
  expect(toggle(wrapper).attributes('aria-label')).toBe('展开规划建议');
  await toggle(wrapper).trigger('click');
  expect(wrapper.text()).toContain(plan.summary);
  expect(wrapper.text()).toContain('香菇鸡肉饭');
  expect(wrapper.emitted('apply')).toBeUndefined();
  expect(wrapper.emitted('discard')).toBeUndefined();
  expect(JSON.stringify(plan)).toBe(before);
  wrapper.unmount();
});

test('normal apply emits the original plan', async () => {
  const plan = makePlan();
  const wrapper = mount(PlanningCard, { props: { plan } });
  await toggle(wrapper).trigger('click');
  expect(apply(wrapper).text()).toBe('加入我的规划');
  expect(apply(wrapper).attributes('aria-disabled')).toBe('false');
  expect(apply(wrapper).attributes('tabindex')).toBe('0');
  await apply(wrapper).trigger('click');
  expect(wrapper.emitted('apply')).toEqual([[plan]]);
  wrapper.unmount();
});

test('successful applied state remains visible and disabled through collapse and expand', async () => {
  const plan = { ...makePlan(), appliedStatus: 'success' };
  const wrapper = mount(PlanningCard, { props: { plan } });
  expect(wrapper.text()).toContain('已加入');
  await toggle(wrapper).trigger('click');
  expect(apply(wrapper).attributes('disabled')).toBeDefined();
  expect(apply(wrapper).attributes('aria-disabled')).toBe('true');
  expect(apply(wrapper).attributes('tabindex')).toBe('-1');
  await apply(wrapper).trigger('click');
  expect(wrapper.emitted('apply')).toBeUndefined();
  expect(plan.appliedStatus).toBe('success');
  wrapper.unmount();
});

test('failed confirmation offers a retry without altering the draft or action', async () => {
  const plan = { ...makePlan(), appliedStatus: 'failed' };
  const wrapper = mount(PlanningCard, { props: { plan } });
  await toggle(wrapper).trigger('click');
  expect(apply(wrapper).text()).toBe('加入失败，重试');
  expect(apply(wrapper).attributes('disabled')).toBeUndefined();
  await apply(wrapper).trigger('click');
  expect(wrapper.emitted('apply')).toEqual([[plan]]);
  expect(plan.appliedStatus).toBe('failed');
  wrapper.unmount();
});

test('long multi-day context remains in the shrinkable header beside the accessible control', () => {
  const plan = makePlan();
  plan.previewData.endDate = '2100-12-31';
  const wrapper = mount(PlanningCard, { props: { plan } });
  expect(wrapper.get('.planning-card-date').text()).toContain('12月31日');
  expect(wrapper.get('.planning-card-title').text()).toBe('午餐规划建议');
  expect(wrapper.get('.planning-card-header').find('button').exists()).toBe(true);
  expect(toggle(wrapper).attributes('aria-label')).toBe('展开规划建议');
  wrapper.unmount();
});

test('real chat rendering isolates collapse across sessions and replacement messages', async () => {
  const messages = ref([
    {
      id: 'message-a',
      type: 'ai',
      content: [
        { type: 'card_plan', data: [makePlan(), makePlan()] },
        { type: 'card_plan', data: [makePlan()] },
      ],
    },
  ]);
  const currentSessionId = ref('session-a');
  (useChat as jest.Mock).mockReturnValue({
    messages,
    currentSessionId,
    aiLoading: ref(false),
    suggestions: ref([]),
    isInitialLoading: ref(false),
    scene: ref('meal_planner'),
    historyEntries: ref([]),
    sendMessage: jest.fn(),
    captureOperation: () => () => true,
    resetChat: jest.fn(),
    setScene: jest.fn(),
    loadHistorySession: jest.fn(),
    applyMealPlan: jest.fn(),
    deleteSession: jest.fn(),
    stopStreaming: jest.fn(),
  });
  (global as any).uni.getSystemInfoSync = () => ({ safeAreaInsets: { top: 0, bottom: 0 } });
  jest.useFakeTimers();
  const wrapper = shallowMount(ChatPage, {
    global: { stubs: { PlanningCard: false, 'page-container': true, picker: true } },
  });
  const cards = () => wrapper.findAllComponents(PlanningCard);
  await toggle(cards()[0]).trigger('click');
  expect(toggle(cards()[1]).attributes('aria-expanded')).toBe('false');
  expect(toggle(cards()[2]).attributes('aria-expanded')).toBe('false');
  currentSessionId.value = 'session-b';
  await wrapper.vm.$nextTick();
  expect(toggle(cards()[0]).attributes('aria-expanded')).toBe('false');
  await toggle(cards()[0]).trigger('click');
  messages.value = [
    {
      id: 'message-b',
      type: 'ai',
      content: [{ type: 'card_plan', data: [makePlan(), makePlan()] }],
    },
  ];
  await wrapper.vm.$nextTick();
  expect(toggle(cards()[0]).attributes('aria-expanded')).toBe('false');
  wrapper.unmount();
  jest.clearAllTimers();
  jest.useRealTimers();
});
