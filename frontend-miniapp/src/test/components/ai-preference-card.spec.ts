import { mount, shallowMount } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import PreferenceCard from '@/pages/ai-chat/components/PreferenceCard.vue';
import ChatPage from '@/pages/ai-chat/index.vue';
import { useChat } from '@/pages/ai-chat/composables/use-chat';

jest.mock('@/pages/ai-chat/composables/use-chat', () => ({ useChat: jest.fn() }));

const makeDraft = () => {
  const before = {
    preferences: {
      tagPreferences: ['清淡'],
      priceRange: { min: 10, max: 40 },
      tastePreferences: { spicyLevel: 1, sweetness: 2, saltiness: 2, oiliness: 1 },
      avoidIngredients: ['香菜'],
    },
    allergens: ['花生'],
  };
  const after = {
    preferences: {
      tagPreferences: ['清淡', '高蛋白'],
      priceRange: { min: 12, max: 25 },
      tastePreferences: { spicyLevel: 0, sweetness: 1, saltiness: 1, oiliness: 1 },
      avoidIngredients: [],
    },
    allergens: ['花生', '虾'],
  };
  return {
    summary: '调整口味与预算，并记录虾过敏。',
    previewData: { before, after },
    confirmAction: { api: '/user/profile', method: 'PUT', body: after },
  } as any;
};
const save = (wrapper: any) => wrapper.get('.preference-save');
const dismiss = (wrapper: any) => wrapper.get('.preference-dismiss');

test('shows readable before/after values and no automatic confirmation on mount', () => {
  const draft = makeDraft();
  const original = JSON.stringify(draft);
  const wrapper = mount(PreferenceCard, { props: { draft } });
  expect(wrapper.text()).toContain('调整前');
  expect(wrapper.text()).toContain('调整后');
  expect(wrapper.text()).toContain('偏好标签');
  expect(wrapper.text()).toContain('清淡、高蛋白');
  expect(wrapper.text()).toContain('¥12 — ¥25');
  expect(wrapper.text()).toContain('未设置');
  expect(wrapper.text()).toContain('忌口食材');
  expect(wrapper.text()).toContain('无');
  expect(wrapper.text()).toContain('过敏原');
  expect(wrapper.text()).toContain('花生、虾');
  expect(save(wrapper).text()).toBe('保存偏好');
  expect(dismiss(wrapper).text()).toBe('暂不保存');
  expect(wrapper.emitted('save')).toBeUndefined();
  expect(wrapper.emitted('dismiss')).toBeUndefined();
  expect(JSON.stringify(draft)).toBe(original);
  wrapper.unmount();
});

test.each(['save', 'dismiss'])('a human %s click emits only the original draft', async action => {
  const draft = makeDraft();
  const wrapper = mount(PreferenceCard, { props: { draft } });
  await (action === 'save' ? save(wrapper) : dismiss(wrapper)).trigger('click');
  expect(wrapper.emitted(action)).toEqual([[draft]]);
  expect(wrapper.emitted(action === 'save' ? 'dismiss' : 'save')).toBeUndefined();
  wrapper.unmount();
});

test.each(['save', 'dismiss'])(
  'UniApp normalized keyboard %s activates once on release and blur cancels a held key',
  async action => {
    const wrapper = mount(PreferenceCard, { props: { draft: makeDraft() } });
    const control = action === 'save' ? save(wrapper) : dismiss(wrapper);
    expect(control.attributes('role')).toBe('button');
    expect(control.attributes('tabindex')).toBe('0');
    for (const key of ['Enter', ' ']) {
      await control.trigger('keydown', { key });
      await control.trigger('keydown', { key, repeat: true });
      const previous = wrapper.emitted(action)?.length || 0;
      await control.trigger('keyup', { key });
      expect(wrapper.emitted(action)).toHaveLength(previous + 1);
      await control.trigger('keyup', { key });
      expect(wrapper.emitted(action)).toHaveLength(previous + 1);
    }
    await control.trigger('keydown', { key: 'Enter' });
    await control.trigger('blur');
    await control.trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted(action)).toHaveLength(2);
    wrapper.unmount();
  }
);

test.each(['saving', 'saved', 'dismissed'])(
  '%s disables both actions and does not emit again',
  async status => {
    const wrapper = mount(PreferenceCard, { props: { draft: { ...makeDraft(), status } } });
    expect(save(wrapper).attributes('disabled')).toBeDefined();
    expect(dismiss(wrapper).attributes('disabled')).toBeDefined();
    expect(save(wrapper).attributes('tabindex')).toBe('-1');
    await save(wrapper).trigger('click');
    await dismiss(wrapper).trigger('click');
    await save(wrapper).trigger('keydown', { key: 'Enter' });
    await save(wrapper).trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted('save')).toBeUndefined();
    expect(wrapper.emitted('dismiss')).toBeUndefined();
    expect(wrapper.get('[role="status"]').text()).toBeTruthy();
    expect(wrapper.find('.preference-summary').exists()).toBe(false);
    wrapper.unmount();
  }
);

test('a failed save keeps all preview values and offers explicit retry or dismissal', async () => {
  const draft = { ...makeDraft(), status: 'failed', error: '网络连接中断，请重试。' };
  const wrapper = mount(PreferenceCard, { props: { draft } });
  expect(wrapper.get('[role="status"]').text()).toContain(draft.error);
  expect(save(wrapper).text()).toBe('重试保存');
  expect(save(wrapper).attributes('disabled')).toBeUndefined();
  expect(wrapper.text()).toContain('花生、虾');
  await save(wrapper).trigger('click');
  expect(wrapper.emitted('save')).toEqual([[draft]]);
  wrapper.unmount();
});

test.each(['stale', 'invalid'])(
  '%s blocks an unsafe save while retaining dismissal and recovery copy',
  status => {
    const wrapper = mount(PreferenceCard, {
      props: { draft: { ...makeDraft(), status, error: '请重新生成偏好建议。' } },
    });
    expect(save(wrapper).attributes('disabled')).toBeDefined();
    expect(dismiss(wrapper).attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[role="status"]').text()).toContain('重新生成');
    wrapper.unmount();
  }
);

test('long Chinese values remain complete and malformed preview data does not crash', async () => {
  const draft = makeDraft();
  const longValue = '需要避免的特殊食材以及与其混合制作的调味原料'.repeat(8);
  draft.previewData.after.allergens = [longValue];
  const wrapper = mount(PreferenceCard, { props: { draft } });
  expect(wrapper.text()).toContain(longValue);
  await wrapper.setProps({
    draft: { summary: '格式无效', previewData: { after: { preferences: 'invalid' } } } as any,
  });
  expect(wrapper.text()).toContain('重新生成');
  await wrapper.setProps({ draft: { summary: '内容缺失', previewData: null } as any });
  expect(wrapper.text()).toContain('重新生成');
  expect(save(wrapper).attributes('disabled')).toBeDefined();
  wrapper.unmount();
});

test('the real page places preference proposals outside chat bubbles and wires only their explicit actions', async () => {
  jest.useFakeTimers();
  const proposal = makeDraft();
  const chat = {
    messages: ref<any[]>([
      { id: 10, type: 'ai', content: [{ type: 'card_preferences', data: [proposal] }] },
    ]),
    currentSessionId: ref('conversation'),
    aiLoading: ref(false),
    suggestions: ref([]),
    isInitialLoading: ref(false),
    isInitializing: ref(false),
    initialError: ref(''),
    scene: ref('general_chat'),
    historyEntries: ref([]),
    sendMessage: jest.fn(),
    captureOperation: () => () => true,
    resetChat: jest.fn(),
    setScene: jest.fn(),
    loadHistorySession: jest.fn(),
    applyMealPlan: jest.fn(),
    applyPreferences: jest.fn(),
    dismissPreferences: jest.fn(),
    deleteSession: jest.fn(),
    stopStreaming: jest.fn(),
  };
  (useChat as jest.Mock).mockReturnValue(chat);
  const wrapper = shallowMount(ChatPage, { global: { stubs: { PreferenceCard: false } } });
  const card = wrapper.findComponent(PreferenceCard);
  expect(card.exists()).toBe(true);
  expect(wrapper.find('.chat-bubble').exists()).toBe(false);
  expect(chat.applyPreferences).not.toHaveBeenCalled();
  await save(card).trigger('click');
  expect(chat.applyPreferences).toHaveBeenCalledWith(proposal);
  await dismiss(card).trigger('click');
  expect(chat.dismissPreferences).toHaveBeenCalledWith(proposal);
  chat.messages.value[0].content = [{ type: 'card_preferences', data: [] }];
  await nextTick();
  expect(wrapper.findAll('.chat-segment')).toHaveLength(0);
  wrapper.unmount();
  jest.clearAllTimers();
  jest.useRealTimers();
});
