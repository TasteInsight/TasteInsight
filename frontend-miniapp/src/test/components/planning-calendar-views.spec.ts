import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, reactive } from 'vue';
import { useMenuPlanning } from '@/pages/planning/composables/use-menu-planning';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { useUserStore } from '@/store/modules/use-user-store';

jest.mock('@/store/modules/use-plan-store', () => ({ usePlanStore: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));

let store: any;
let user: any;
const wrappers: any[] = [];
const plan = (id: string, mealTime: string, startDate = '2026-12-31', endDate = startDate) => ({
  id,
  mealTime,
  startDate,
  endDate,
  dishes: [],
  completedDates: [],
  isCompleted: false,
  isExpired: false,
  dishesReady: true,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-12-31T04:00:00Z'));
  user = reactive({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'A' } });
  store = reactive({
    loading: false,
    initialized: true,
    error: null,
    allPlans: [],
    enrichedPlans: [],
    currentPlans: [],
    historyPlans: [],
    selectedPlan: null,
    fetchPlans: jest.fn(),
    refreshClock: jest.fn(),
    setSelectedPlan: jest.fn(),
    executePlan: jest.fn(),
  });
  (usePlanStore as unknown as jest.Mock).mockReturnValue(store);
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.useRealTimers();
});

function planning() {
  let model!: ReturnType<typeof useMenuPlanning>;
  wrappers.push(
    mount(
      defineComponent({
        setup() {
          model = useMenuPlanning();
          return () => null;
        },
      })
    )
  );
  return model;
}

test('the compact week starts on the campus date and all four view switches preserve selection', () => {
  const model = planning();
  expect(model.viewMode.value).toBe('week');
  expect(model.selectedDate.value).toBe('2026-12-31');
  model.selectDate('2027-01-02');
  for (const mode of ['month', 'day', 'list', 'week'] as const) {
    model.setViewMode(mode);
    expect(model.viewMode.value).toBe(mode);
    expect(model.selectedDate.value).toBe('2027-01-02');
  }
});

test('calendar views show only the selected occurrence in meal order, while list categories remain unfiltered', () => {
  const dinner = plan('dinner', 'dinner');
  const breakfast = {
    ...plan('breakfast', 'breakfast', '2026-12-30', '2027-01-01'),
    completedDates: ['2026-12-31'],
  };
  store.enrichedPlans = [dinner, plan('later', 'lunch', '2027-01-03'), breakfast];
  store.currentPlans = [dinner];
  store.historyPlans = [plan('history', 'lunch', '2026-11-30')];
  const model = planning();
  expect(model.displayPlans.value.map(item => item.id)).toEqual(['breakfast', 'dinner']);
  expect(model.displayPlans.value[0].isCompleted).toBe(true);
  model.selectDate('2026-12-30');
  expect(model.displayPlans.value[0]).toMatchObject({
    id: 'breakfast',
    isCompleted: false,
    isExpired: true,
  });
  model.setViewMode('list');
  expect(model.displayPlans.value.map(item => item.id)).toEqual(['dinner']);
  model.switchTab('history');
  expect(model.displayPlans.value.map(item => item.id)).toEqual(['history']);
  model.setViewMode('day');
  expect(model.selectedDate.value).toBe('2026-12-30');
  expect(model.displayPlans.value.map(item => item.id)).toEqual(['breakfast']);
});

test('calendar completion uses its selected day and list completion delegates the effective date to the store', async () => {
  const model = planning();
  model.selectDate('2026-12-30');
  await model.executePlan('meal', true);
  expect(store.executePlan).toHaveBeenLastCalledWith('meal', '2026-12-30', true);
  model.setViewMode('list');
  await model.executePlan('meal', false);
  expect(store.executePlan).toHaveBeenLastCalledWith('meal', undefined, false);
  model.setViewMode('month');
  expect(model.selectedDate.value).toBe('2026-12-30');
});

test('account changes reset the calendar and close private plan dialogs', async () => {
  const model = planning();
  model.selectDate('2027-02-01');
  model.setViewMode('day');
  model.viewPlanDetail(plan('private', 'lunch') as any);
  user.sessionVersion++;
  user.userInfo = { id: 'B' };
  await nextTick();
  expect(model.viewMode.value).toBe('week');
  expect(model.selectedDate.value).toBe('2026-12-31');
  expect(model.showDetailDialog.value).toBe(false);
});

test('returning after campus midnight refreshes today without moving a deliberately selected date', () => {
  const model = planning();
  model.selectDate('2026-12-30');
  jest.setSystemTime(new Date('2026-12-31T16:00:00Z'));
  model.handlePageShow();
  expect(model.today.value).toBe('2027-01-01');
  expect(model.selectedDate.value).toBe('2026-12-30');
  expect(store.refreshClock).toHaveBeenCalled();
});
