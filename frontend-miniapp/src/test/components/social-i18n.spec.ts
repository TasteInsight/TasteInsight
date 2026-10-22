import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { locale, t } from '@/i18n';
import { zhHans, en } from '@/i18n/messages/social';
import PlanCalendar from '@/pages/planning/components/PlanCalendar.vue';
import PlanCard from '@/pages/planning/components/PlanCard.vue';
import PreferenceCard from '@/pages/ai-chat/components/PreferenceCard.vue';
import CanteenCard from '@/pages/ai-chat/components/CanteenCard.vue';
import InputBar from '@/pages/ai-chat/components/InputBar.vue';
import { notificationText, notificationTitle } from '@/pages/notifications/notification-content';
import { useNewsItem } from '@/pages/news/composables/use-news-item';
import { useNewsList } from '@/pages/news/composables/use-news-list';
import { getNewsList } from '@/api/modules/news';
import { mealPlanChanges, mealPlanDishNotices } from '@/utils/meal-plan-changes';
jest.mock('@/api/modules/news', () => ({ getNewsList: jest.fn() }));
const wrappers: ReturnType<typeof mount>[] = [];
beforeEach(() => {
  locale.value = 'zh-Hans';
  jest.clearAllMocks();
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  locale.value = 'zh-Hans';
});
function render(component: any, props: any = {}) {
  const wrapper = mount(component, { props });
  wrappers.push(wrapper);
  return wrapper;
}
async function english() {
  locale.value = 'en';
  await nextTick();
}

test('social translations have matching interpolation contracts and compile in both languages', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zhHans).sort());
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const key of Object.keys(zhHans) as (keyof typeof zhHans)[]) {
      const parameters = (value: string) =>
        [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort();
      expect(parameters(en[key])).toEqual(parameters(zhHans[key]));
      expect(en[key]).not.toMatch(/[\u3400-\u9fff]/);
      for (const language of ['zh-Hans', 'en'] as const) {
        locale.value = language;
        const params = Object.fromEntries(parameters(zhHans[key]).map(name => [name, 'sample']));
        expect(t(`social.${key}`, params)).not.toBe(`social.${key}`);
      }
    }
    expect(errors).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
});

test('mounted calendar updates weekday, period and accessible labels without losing its date', async () => {
  const wrapper = render(PlanCalendar, {
    selectedDate: '2026-10-22',
    today: '2026-10-22',
    mode: 'day',
  });
  expect(wrapper.text()).toContain('10 月 22 日 · 周四');
  await english();
  expect(wrapper.text()).toContain('10/22 · Thu');
  expect(wrapper.find('[aria-label="Next day"]').exists()).toBe(true);
  await wrapper.setProps({ mode: 'week' });
  expect(wrapper.get('.calendar-week').text()).toContain('Mon');
  expect(wrapper.get('.calendar-day-selected').attributes('aria-label')).toBe(
    '2026-10-22, 0 plans, 0 eaten'
  );
  await wrapper.get('[aria-label="Next week"]').trigger('click');
  expect(wrapper.emitted('select')?.[0]).toEqual(['2026-10-29']);
});

test('meal labels and dates update while dish names stay as supplied', async () => {
  const wrapper = render(PlanCard, {
    plan: {
      id: 'plan',
      startDate: '2026-10-22',
      endDate: '2026-10-22',
      mealTime: 'lunch',
      dishesReady: true,
      isCompleted: false,
      isExpired: false,
      dishes: [
        { id: 'dish', name: '番茄炒蛋', price: 8, priceUnit: '份', images: [], averageRating: 0 },
      ],
    },
    today: '2026-10-22',
  });
  expect(wrapper.text()).toContain('午餐');
  await english();
  expect(wrapper.text()).toContain('Lunch');
  expect(wrapper.text()).toContain('Oct 22');
  expect(wrapper.text()).toContain('番茄炒蛋');
  expect(wrapper.text()).toContain('Mark eaten');
});

test('preference previews translate local fields and levels while preserving user preference values', async () => {
  const wrapper = render(PreferenceCard, {
    draft: {
      previewData: {
        before: { preferences: { tagPreferences: ['家常'], tastePreferences: { spicyLevel: 1 } } },
        after: { preferences: { tagPreferences: ['清淡'], tastePreferences: { spicyLevel: 3 } } },
      },
    },
  });
  expect(wrapper.text()).toContain('辣度');
  await english();
  expect(wrapper.text()).toContain('Spiciness');
  expect(wrapper.text()).toContain('Mild');
  expect(wrapper.text()).toContain('Hot');
  expect(wrapper.text()).toContain('清淡');
  expect(wrapper.get('.preference-save').text()).toBe('Save preferences');
});

test('AI entry controls and canteen cards update their local labels and keep backend names', async () => {
  const input = render(InputBar, { modelValue: '', loading: false, busy: false });
  const card = render(CanteenCard, { canteen: { id: 'c', name: '紫荆园', status: 'open' } });
  await english();
  expect(input.get('[aria-label="Message input"]').attributes('placeholder')).toBe(
    'Tell me your tastes or ask what to eat today'
  );
  expect(input.find('[aria-label="Send message"]').exists()).toBe(true);
  expect(card.attributes('aria-label')).toBe('View dining hall: 紫荆园');
  expect(card.text()).toContain('紫荆园');
  expect(card.text()).toContain('Open');
});

test('notification events and news fallback labels use the active language at display time', async () => {
  const notification = { type: 'upload_approved', targetType: 'dish_upload' } as any;
  expect(notificationTitle(notification)).toBe('菜品资料已采纳');
  await english();
  expect(notificationTitle(notification)).toBe('Dish information accepted');
  expect(
    notificationText({ type: 'like', targetType: 'post', actor: { nickname: '小李' } } as any)
  ).toBe('小李 liked your post');
  const news = useNewsItem();
  expect(news.getNewsTagText({ title: '校内活动' } as any)).toBe('Campus news');
  expect(news.getNewsSummary({ content: '<p>食堂菜单</p>' } as any)).toBe('食堂菜单');
});

test('a visible local news failure updates after changing language and keeps the retry available', async () => {
  (getNewsList as jest.Mock).mockRejectedValue(new Error('offline'));
  const wrapper = render(
    defineComponent({
      setup: () => useNewsList(),
      template: '<button @click="retry">{{ error }}</button>',
    })
  );
  await flushPromises();
  expect(wrapper.text()).toBe('新闻加载失败，请重试');
  await english();
  expect(wrapper.text()).toBe('Failed to load news. Try again.');
  await wrapper.get('button').trigger('click');
  await flushPromises();
  expect(getNewsList).toHaveBeenCalledTimes(2);
});

test('new meal change notices preserve pricing and supply semantics in English', async () => {
  await english();
  const dish = {
    id: 'd',
    name: '蒸鱼',
    status: 'online',
    price: 12,
    priceUnit: '份',
    availableMealTime: ['dinner'],
  } as any;
  const schedule = { startDate: '2026-10-22', endDate: '2026-10-22', mealTime: 'lunch' };
  expect(mealPlanDishNotices(dish, schedule)).toEqual(['Unavailable for this meal']);
  const notices = mealPlanChanges([{ ...dish, price: 10 }], [dish], schedule, { totalBudget: 8 });
  expect(notices.find(notice => notice.kind === 'price')?.message).toContain(
    'Unit price increased from ¥10.00'
  );
  expect(notices.find(notice => notice.kind === 'budget')?.message).toBe(
    'Current listed prices total ¥12.00, above the original budget of ¥8.00'
  );
});
