import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { locale } from '@/i18n';
import { useChatStore } from '@/store/modules/use-chat-store';
import PreferenceCard from '@/pages/ai-chat/components/PreferenceCard.vue';
import PlanningCard from '@/pages/ai-chat/components/PlanningCard.vue';
import { createAISession, streamAIChat } from '@/api/modules/ai';
import { createMealPlan } from '@/api/modules/meal-plan';
import { getDishesByIds } from '@/api/modules/dish';
import { mealPlanChanges } from '@/utils/meal-plan-changes';

let mockUser: any;
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@/mock/mock-adapter', () => ({ USE_MOCK: false }));
jest.mock('@/api/modules/meal-plan', () => ({ createMealPlan: jest.fn() }));
jest.mock('@/api/modules/dish', () => ({ getDishesByIds: jest.fn() }));
jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  streamAIChat: jest.fn(),
  submitRecommendFeedback: jest.fn(),
  deleteAISession: jest.fn(),
}));
const storage = new Map<string, any>();
const wrappers: ReturnType<typeof mount>[] = [];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const firstPreference = (messages: any[]) =>
  messages.flatMap(message => message.content).find(segment => segment.type === 'card_preferences')
    .data[0];

beforeEach(() => {
  locale.value = 'zh-Hans';
  jest.clearAllMocks();
  storage.clear();
  mockUser = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: { id: 'user', preferences: { tagPreferences: ['清淡'] } },
    fetchProfileAction: jest.fn().mockResolvedValue(undefined),
    updateProfileAction: jest.fn().mockResolvedValue(undefined),
  });
  uni.$emit = jest.fn();
  uni.getStorageSync = jest.fn(key => storage.get(key));
  uni.setStorageSync = jest.fn((key, value) => storage.set(key, clone(value)));
  setActivePinia(createPinia());
  (streamAIChat as jest.Mock).mockReturnValue({ close: jest.fn() });
  (createMealPlan as jest.Mock).mockResolvedValue({ code: 201 });
  (createAISession as jest.Mock).mockResolvedValue({ code: 200, data: { sessionId: 'session' } });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  locale.value = 'zh-Hans';
});

async function preferenceFailure(status: 'invalid' | 'stale' | 'failed') {
  const store = useChatStore();
  await store.initSession();
  const before = { preferences: { tagPreferences: ['清淡'] } };
  const after = { preferences: { tagPreferences: ['高蛋白'] } };
  store.messages.push({
    id: 1,
    type: 'ai',
    timestamp: Date.now(),
    content: [
      { type: 'text', text: '偏好建议原文' },
      {
        type: 'card_preferences',
        data: [
          {
            summary: '按口味调整',
            previewData: { before, after },
            confirmAction: { api: '/user/profile', method: 'PUT', body: clone(after) },
          },
        ],
      },
    ],
  });
  const card = firstPreference(store.messages);
  if (status === 'invalid') card.confirmAction.method = 'DELETE';
  if (status === 'stale') mockUser.userInfo.preferences.tagPreferences = ['低糖'];
  if (status === 'failed')
    mockUser.updateProfileAction.mockRejectedValueOnce(new Error('后端原始详情'));
  expect(await store.applyPreferences(card)).toBe(false);
  expect(card.status).toBe(status);
  return { store, card };
}

const preferenceCases = [
  ['invalid', 'This preference suggestion is incomplete or invalid. Generate another suggestion.'],
  ['stale', 'Your preferences have changed. Generate another suggestion before saving.'],
  ['failed', 'Failed to save. Try again. 后端原始详情'],
] as const;

test.each(preferenceCases)(
  'a mounted %s preference error changes with the display language',
  async (status, expected) => {
    const { card } = await preferenceFailure(status);
    const wrapper = mount(PreferenceCard, { props: { draft: card } });
    wrappers.push(wrapper);
    locale.value = 'en';
    await nextTick();
    expect(wrapper.get('.preference-message[role="status"]').text()).toBe(expected);
    expect(wrapper.text()).toContain('按口味调整');
  }
);

test.each(preferenceCases)(
  'a serialized %s preference error uses the language of the restored UI',
  async (status, expected) => {
    await preferenceFailure(status);
    locale.value = 'en';
    setActivePinia(createPinia());
    const restored = useChatStore();
    expect(restored.loadSessionFromHistory('session')).toBe(true);
    const card = firstPreference(restored.messages);
    const wrapper = mount(PreferenceCard, { props: { draft: card } });
    wrappers.push(wrapper);
    expect(wrapper.get('.preference-message[role="status"]').text()).toBe(expected);
    expect(restored.messages[0].content[0]).toEqual({ type: 'text', text: '偏好建议原文' });
  }
);

test('serialized application change notices and prior-price units translate on a mounted plan', async () => {
  const schedule = { startDate: '2026-10-22', endDate: '2026-10-22', mealTime: 'lunch' as const };
  const before = {
    id: 'dish',
    name: '番茄炒蛋',
    price: 10,
    priceUnit: '份',
    status: 'offline',
    availableMealTime: ['dinner'],
  } as any;
  const after = { ...before, price: 12, status: 'online', availableMealTime: ['lunch'] };
  const plan = clone({
    previewData: { ...schedule, dishes: [after] },
    appliedStatus: 'success',
    changeNotices: mealPlanChanges([before], [after], schedule, { totalBudget: 8 }),
  });
  const wrapper = mount(PlanningCard, { props: { plan: plan as any } });
  wrappers.push(wrapper);
  locale.value = 'en';
  await nextTick();
  expect(wrapper.get('.planning-change-summary').text()).toContain(
    'Unit price increased from ¥10.00/serving to ¥12.00/serving'
  );
  expect(wrapper.get('.planning-change-summary').text()).toContain('Available again');
  expect(wrapper.get('.planning-change-summary').text()).toContain(
    'Current listed prices total ¥12.00, above the original budget of ¥8.00'
  );
  await wrapper.get('[aria-expanded]').trigger('click');
  expect(wrapper.get('.planning-price-change').text()).toBe('Previously ¥10.00/serving');
  expect(wrapper.text()).toContain('番茄炒蛋');
});

test('price-unit business comparisons give the same notices in either display language', () => {
  const schedule = { startDate: '2026-10-22', endDate: '2026-10-22', mealTime: 'lunch' };
  const before = { id: 'dish', price: 10, priceUnit: '元/份', status: 'online' } as any;
  const after = { ...before, priceUnit: 'serving' };
  const zhNotices = mealPlanChanges([before], [after], schedule);
  locale.value = 'en';
  const enNotices = mealPlanChanges([before], [after], schedule);
  expect(zhNotices).toHaveLength(1);
  expect(
    enNotices.map(notice => ({
      kind: notice.kind,
      unitChanged: notice.kind === 'price' ? notice.unitChanged : undefined,
    }))
  ).toEqual(
    zhNotices.map(notice => ({
      kind: notice.kind,
      unitChanged: notice.kind === 'price' ? notice.unitChanged : undefined,
    }))
  );
});

test('a save failure without an external Error keeps its local recovery text translatable', async () => {
  const { store, card } = await preferenceFailure('failed');
  mockUser.updateProfileAction.mockRejectedValueOnce({ code: 'offline' });
  expect(await store.applyPreferences(card)).toBe(false);
  const wrapper = mount(PreferenceCard, { props: { draft: card } });
  wrappers.push(wrapper);
  locale.value = 'en';
  await nextTick();
  expect(wrapper.get('.preference-message[role="status"]').text()).toBe(
    'Failed to save. Try again. Check your network connection.'
  );
  expect(await store.applyPreferences(card)).toBe(true);
  expect(card.errorKey).toBeUndefined();
  expect(card.errorParams).toBeUndefined();
  expect(card.error).toBeUndefined();
  expect(wrapper.get('.preference-message[role="status"]').text()).toBe('Preferences saved.');
});

test('restoring an interrupted save creates a translatable local error in the restored card', async () => {
  await preferenceFailure('failed');
  const history = storage.get('ai-chat-history:user');
  const stored = firstPreference(history[0].messages);
  stored.status = 'saving';
  stored.error = '旧的外部详情';
  setActivePinia(createPinia());
  const restored = useChatStore();
  expect(restored.loadSessionFromHistory('session')).toBe(true);
  const card = firstPreference(restored.messages);
  const wrapper = mount(PreferenceCard, { props: { draft: card } });
  wrappers.push(wrapper);
  locale.value = 'en';
  await nextTick();
  expect(wrapper.get('.preference-message[role="status"]').text()).toBe(
    'The previous save was unconfirmed. Retry to check your latest preferences.'
  );
  expect(card.error).toBeUndefined();
  expect(card.errorParams).toBeUndefined();
});

async function appliedPlan(metadataUnavailable: boolean) {
  const store = useChatStore();
  await store.initSession();
  const schedule = { startDate: '2026-10-22', endDate: '2026-10-22', mealTime: 'lunch' as const };
  const before = {
    id: 'dish',
    name: '番茄炒蛋',
    price: 10,
    priceUnit: '份',
    status: 'online',
    availableMealTime: ['lunch'],
  };
  const after = { ...before, price: 12, availableMealTime: ['dinner'] };
  store.messages.push({
    id: 1,
    type: 'ai',
    timestamp: Date.now(),
    content: [
      { type: 'text', text: '保留规划建议正文' },
      {
        type: 'card_plan',
        data: [
          {
            previewData: { ...schedule, dishes: [before as any] },
            confirmAction: { body: { ...schedule, dishes: ['dish'] } },
          },
        ],
      },
    ],
  });
  if (metadataUnavailable)
    (getDishesByIds as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  else (getDishesByIds as jest.Mock).mockResolvedValueOnce({ code: 200, data: { items: [after] } });
  const card = (store.messages[0].content[1] as any).data[0];
  expect(await store.applyMealPlan(card)).toBe(true);
  locale.value = 'en';
  setActivePinia(createPinia());
  const restored = useChatStore();
  expect(restored.loadSessionFromHistory('session')).toBe(true);
  return { restored, card: (restored.messages[0].content[1] as any).data[0] };
}

test.each([false, true])(
  'application notices survive chat history serialization and display-time translation (metadata unavailable: %p)',
  async metadataUnavailable => {
    const { restored, card } = await appliedPlan(metadataUnavailable);
    const wrapper = mount(PlanningCard, { props: { plan: card } });
    wrappers.push(wrapper);
    if (metadataUnavailable) {
      expect(wrapper.get('.planning-change-summary').text()).toBe(
        'Latest dish information is temporarily unavailable. Check My plans.'
      );
      await wrapper.get('[aria-expanded]').trigger('click');
      expect(wrapper.get('.planning-card-footer [role="status"]').text()).toBe(
        'Latest dish information is temporarily unavailable. Check My plans.'
      );
    } else {
      expect(wrapper.get('.planning-change-summary').text()).toContain('Unit price increased');
      expect(wrapper.get('.planning-change-summary').text()).toContain('Unavailable for this meal');
      await wrapper.get('[aria-expanded]').trigger('click');
      expect(wrapper.findAll('.planning-dish-supply').map(item => item.text())).toEqual([
        'Unavailable for this meal',
      ]);
      expect(wrapper.get('.planning-price-change').text()).toBe('Previously ¥10.00/serving');
    }
    expect(restored.messages[0].content[0]).toEqual({ type: 'text', text: '保留规划建议正文' });
    expect(createMealPlan).toHaveBeenCalledTimes(1);
  }
);

test('legacy preference errors and service-authored plan notice text remain unchanged', () => {
  locale.value = 'en';
  const preference = mount(PreferenceCard, {
    props: {
      draft: {
        status: 'failed',
        error: '旧版错误原文',
        previewData: { before: {}, after: { allergens: ['花生'] } },
      } as any,
    },
  });
  wrappers.push(preference);
  expect(preference.get('.preference-message[role="status"]').text()).toBe('旧版错误原文');
  const plan = mount(PlanningCard, {
    props: { plan: { changeNotices: [{ kind: 'metadata', message: '服务端通知原文' }] } },
  });
  wrappers.push(plan);
  expect(plan.get('.planning-change-summary').text()).toBe('服务端通知原文');
});

test('incoming model notices cannot acquire client-only localization metadata', async () => {
  const store = useChatStore();
  expect(await store.sendChatMessage('推荐一餐')).toBe(true);
  const hooks = (streamAIChat as jest.Mock).mock.calls[0][2];
  hooks.onEvent('new_block');
  hooks.onJSON({
    type: 'card_plan',
    data: [
      {
        changeNotices: [
          {
            kind: 'metadata',
            message: '模型通知原文',
            messageKey: 'social.preferencesChanged',
            messageParams: { p0: 'model detail' },
          },
        ],
      },
    ],
  });
  hooks.onComplete();
  const segment = store.messages
    .flatMap(message => message.content)
    .find(block => block.type === 'card_plan') as any;
  expect(segment.data[0].changeNotices).toEqual([{ kind: 'metadata', message: '模型通知原文' }]);
  locale.value = 'en';
  const wrapper = mount(PlanningCard, { props: { plan: segment.data[0] } });
  wrappers.push(wrapper);
  expect(wrapper.get('.planning-change-summary').text()).toBe('模型通知原文');
});
