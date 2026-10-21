import type { Dish, MealPlanConstraints, MealPlanChangeNotice } from '@/types/api';
import { priceUnitSuffix } from '@/utils/price-display';
import { addDays, planDateKey } from '@/pages/planning/utils/meal-plan-date';

type Schedule = { startDate: string; endDate: string; mealTime: string };

function supplyRanges(dish: Dish) {
  return (dish.availableDates || [])
    .map(range => ({
      start: planDateKey(String(range.startDate)),
      end: planDateKey(String(range.endDate)),
    }))
    .filter(range => range.start && range.end && range.start <= range.end)
    .sort(
      (left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end)
    );
}

function supplyDatesCover(dish: Dish, schedule: Schedule): boolean {
  if (!dish.availableDates?.length) return true;
  const ranges = supplyRanges(dish);
  let next = planDateKey(schedule.startDate);
  const end = planDateKey(schedule.endDate);
  for (const range of ranges) {
    if (range.end < next) continue;
    if (range.start > next) return false;
    if (range.end >= end) return true;
    next = addDays(range.end, 1);
  }
  return false;
}

export function mealPlanDishNotices(dish: Dish, schedule?: Schedule): string[] {
  if (dish.status === 'offline') return [];
  if (!schedule) return [];
  const notices: string[] = [];
  if (dish.availableMealTime && !dish.availableMealTime.some(time => time === schedule.mealTime))
    notices.push('该餐次暂停供应');
  if (!supplyDatesCover(dish, schedule)) notices.push('规划日期内部分日期暂停供应');
  return notices;
}

export function mealPlanChanges(
  previous: Dish[],
  current: Dish[],
  schedule: Schedule,
  constraints?: MealPlanConstraints
): MealPlanChangeNotice[] {
  const beforeById = new Map(previous.map(dish => [dish.id, dish]));
  const notices: MealPlanChangeNotice[] = [];
  for (const dish of current) {
    const before = beforeById.get(dish.id);
    if (before && Number.isFinite(before.price)) {
      const previousUnit = priceUnitSuffix(before.priceUnit);
      const currentUnit = priceUnitSuffix(dish.priceUnit);
      const unitChanged = previousUnit !== currentUnit;
      const priceChanged = Math.round(before.price * 100) !== Math.round(dish.price * 100);
      if (unitChanged || priceChanged) {
        const previousPriceLabel = `¥${before.price.toFixed(2)}${previousUnit}`;
        const currentPriceLabel = `¥${dish.price.toFixed(2)}${currentUnit}`;
        const direction = dish.price > before.price ? '上涨' : '下降';
        notices.push({
          kind: 'price',
          dishId: dish.id,
          previousPriceLabel,
          unitChanged,
          message: unitChanged
            ? `计价方式由 ${previousPriceLabel} 调整为 ${currentPriceLabel}`
            : `单价由 ${previousPriceLabel} ${direction}至 ${currentPriceLabel}`,
        });
      }
    }
    if (dish.status === 'offline')
      notices.push({ kind: 'status', dishId: dish.id, message: '已下架' });
    const supply = mealPlanDishNotices(dish, schedule);
    notices.push(...supply.map(message => ({ kind: 'supply' as const, dishId: dish.id, message })));
    if (dish.status !== 'offline' && !supply.length && before) {
      if (before.status === 'offline' && dish.status === 'online')
        notices.push({ kind: 'status', dishId: dish.id, message: '已恢复供应' });
      else if (
        (before.availableMealTime &&
          JSON.stringify([...before.availableMealTime].sort()) !==
            JSON.stringify([...(dish.availableMealTime || [])].sort())) ||
        (before.availableDates !== undefined &&
          JSON.stringify(supplyRanges(before)) !== JSON.stringify(supplyRanges(dish)))
      )
        notices.push({ kind: 'supply', dishId: dish.id, message: '供应安排已更新' });
    }
  }
  const total = current.reduce((sum, dish) => sum + Math.round(dish.price * 100), 0);
  if (constraints?.totalBudget !== undefined && total > Math.round(constraints.totalBudget * 100))
    notices.push({
      kind: 'budget',
      message: `当前单价合计 ¥${(total / 100).toFixed(2)}，高于原预算 ¥${constraints.totalBudget.toFixed(2)}`,
    });
  return notices;
}
