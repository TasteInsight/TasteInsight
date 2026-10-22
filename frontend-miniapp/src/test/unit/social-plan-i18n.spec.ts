import { createPinia, setActivePinia } from 'pinia';
import { locale } from '@/i18n';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { getMealPlans, createMealPlan } from '@/api/modules/meal-plan';
import { getDishesByIds } from '@/api/modules/dish';

jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'user' } }),
}));
jest.mock('@/api/modules/meal-plan');
jest.mock('@/api/modules/dish');

const plan = {
  id: 'plan',
  userId: 'user',
  dishes: ['dish'],
  startDate: '2026-10-22',
  endDate: '2026-10-22',
  mealTime: 'lunch',
};
let errors: jest.SpyInstance;
beforeEach(() => {
  locale.value = 'zh-Hans';
  setActivePinia(createPinia());
  jest.clearAllMocks();
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  (getDishesByIds as jest.Mock).mockResolvedValue({ code: 404, data: null });
});
afterEach(() => {
  locale.value = 'zh-Hans';
  errors.mockRestore();
});

test('plan read failures translate at display time while callers receive a readable error', async () => {
  (getMealPlans as jest.Mock).mockResolvedValue({ code: 200, data: { items: [plan] } });
  const store = usePlanStore();
  await expect(store.fetchPlans()).rejects.toThrow('规划菜品资料暂时无法读取');
  expect(store.error).toContain('规划菜品资料暂时无法读取');
  locale.value = 'en';
  expect(store.error).toBe('Dish details for this plan are temporarily unavailable. Try again.');
});

test('a committed plan keeps its saved status and translates the readback failure without another write', async () => {
  (createMealPlan as jest.Mock).mockResolvedValue({ code: 201, data: plan });
  const store = usePlanStore();
  await store.createPlan({} as any);
  expect(store.error).toContain('规划已保存');
  locale.value = 'en';
  expect(store.error).toBe(
    'Plan saved. Failed to load dish details. Try again. Dish details for this plan are temporarily unavailable. Try again.'
  );
  expect(createMealPlan).toHaveBeenCalledTimes(1);
  expect(store.allPlans).toHaveLength(1);
});
