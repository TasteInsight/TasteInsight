import { mount } from '@vue/test-utils';
import PlanCalendar from '@/pages/planning/components/PlanCalendar.vue';
import {
  calendarDays,
  campusToday,
  coversDate,
  weekDays,
  shiftMonthDate,
} from '@/pages/planning/utils/meal-plan-date';
import type { MealPlan } from '@/types/api';

const plan: MealPlan = {
  id: 'range',
  userId: 'owner',
  createdAt: '2026-09-30T00:00:00Z',
  startDate: '2026-09-30',
  endDate: '2026-10-02',
  mealTime: 'lunch',
  dishes: [],
  completedDates: ['2026-10-01'],
};

test('calendar expands only the visible month grid and counts each inclusive occurrence', () => {
  const days = calendarDays('2026-10', [plan], '2026-10-01');
  expect(days).toHaveLength(42);
  expect(days.filter(day => day.count > 0).map(day => day.date)).toEqual([
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
  ]);
  expect(days.filter(day => day.completed > 0).map(day => day.date)).toEqual(['2026-10-01']);
  expect(coversDate(plan, '2026-10-03')).toBe(false);
});

test('campus dates cross midnight independently of device timezone', () => {
  expect(campusToday(new Date('2026-10-08T15:59:59Z'))).toBe('2026-10-08');
  expect(campusToday(new Date('2026-10-08T16:00:00Z'))).toBe('2026-10-09');
});

test('date buttons expose plans and completion independently and navigate months', async () => {
  const wrapper = mount(PlanCalendar, {
    props: { plans: [plan], today: '2026-10-01', selectedDate: '2026-10-01', mode: 'month' },
  });
  await wrapper.get('button[aria-label="2026-10-01，1 个计划，1 个已吃"]').trigger('click');
  expect(wrapper.emitted('select')?.[0]).toEqual(['2026-10-01']);
  await wrapper.get('button[aria-label="下个月"]').trigger('click');
  expect(wrapper.emitted('select')?.[1]).toEqual(['2026-11-01']);
  await wrapper.setProps({ selectedDate: '2026-11-01' });
  expect(wrapper.text()).toContain('11 月');
  await wrapper.get('.calendar-today').trigger('click');
  expect(wrapper.emitted('select')?.[2]).toEqual(['2026-10-01']);
  wrapper.unmount();
});

test('week rows span seven Monday-first dates across years and include completion marks', () => {
  const spanningPlan = {
    ...plan,
    startDate: '2026-12-31',
    endDate: '2027-01-02',
    completedDates: ['2026-12-31'],
  };
  const days = weekDays('2027-01-01', [spanningPlan], '2027-01-01');
  expect(days.map(day => day.date)).toEqual([
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ]);
  expect(days.find(day => day.date === '2026-12-31')).toMatchObject({ count: 1, completed: 1 });
  expect(days.find(day => day.date === '2027-01-01')).toMatchObject({ count: 1, isToday: true });
});

test('month navigation clamps the selected day instead of rolling into a second month', () => {
  expect(shiftMonthDate('2026-01-31', 1)).toBe('2026-02-28');
  expect(shiftMonthDate('2028-01-31', 1)).toBe('2028-02-29');
  expect(shiftMonthDate('2026-12-31', 1)).toBe('2027-01-31');
  expect(shiftMonthDate('2027-01-01', -1)).toBe('2026-12-01');
});

test('switching month, week and day modes keeps the controlled date and offers the correct period step', async () => {
  const wrapper = mount(PlanCalendar, {
    props: { selectedDate: '2026-12-31', today: '2026-10-09', mode: 'month' },
  });
  expect(wrapper.findAll('.calendar-day')).toHaveLength(42);
  await wrapper.setProps({ mode: 'week' });
  expect(wrapper.findAll('.calendar-day')).toHaveLength(7);
  expect(wrapper.get('.calendar-day-selected').attributes('aria-label')).toContain('2026-12-31');
  await wrapper.get('[aria-label="下一周"]').trigger('click');
  expect(wrapper.emitted('select')?.[0]).toEqual(['2027-01-07']);
  await wrapper.setProps({ mode: 'day' });
  expect(wrapper.findAll('.calendar-day')).toHaveLength(0);
  await wrapper.get('[aria-label="下一天"]').trigger('click');
  expect(wrapper.emitted('select')?.[1]).toEqual(['2027-01-01']);
  await wrapper.get('[aria-label="上一天"]').trigger('click');
  expect(wrapper.emitted('select')?.[2]).toEqual(['2026-12-30']);
  await wrapper.get('picker').trigger('change', { detail: { value: '2028-02-29' } });
  expect(wrapper.emitted('select')?.[3]).toEqual(['2028-02-29']);
  await wrapper.get('.calendar-today').trigger('click');
  expect(wrapper.emitted('select')?.[4]).toEqual(['2026-10-09']);
  wrapper.unmount();
});
