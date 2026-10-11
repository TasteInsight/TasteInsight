import type { MealPlan } from '@/types/api';

export function campusToday(now = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function planDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : campusToday(date);
}

export function addDays(value: string, days: number): string {
  return new Date(Date.parse(value + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
}

export function coversDate(plan: Pick<MealPlan, 'startDate' | 'endDate'>, date: string): boolean {
  return planDateKey(plan.startDate) <= date && planDateKey(plan.endDate) >= date;
}

function markedDays(first: string, count: number, month: string, plans: MealPlan[], today: string) {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(first, index);
    const matches = plans.filter(plan => coversDate(plan, date));
    return {
      date,
      day: Number(date.slice(-2)),
      inMonth: date.startsWith(month),
      isToday: date === today,
      count: matches.length,
      completed: matches.filter(plan => plan.completedDates?.includes(date)).length,
    };
  });
}

export function calendarDays(month: string, plans: MealPlan[], today: string) {
  const first = month + '-01';
  const weekday = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return markedDays(addDays(first, -weekday), 42, month, plans, today);
}

export function weekDays(selectedDate: string, plans: MealPlan[], today: string) {
  const weekday = (new Date(selectedDate + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return markedDays(addDays(selectedDate, -weekday), 7, selectedDate.slice(0, 7), plans, today);
}

export function shiftMonth(month: string, amount: number): string {
  const date = new Date(month + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function shiftMonthDate(value: string, amount: number): string {
  const month = shiftMonth(value.slice(0, 7), amount);
  const lastDay = new Date(shiftMonth(month, 1) + '-01T00:00:00Z');
  lastDay.setUTCDate(0);
  const day = Math.min(Number(value.slice(-2)), lastDay.getUTCDate());
  return `${month}-${String(day).padStart(2, '0')}`;
}
