import { t } from '@/i18n';
import type { Dish, MealPlanConstraints, MealPlanChangeNotice } from '@/types/api';
import { normalizePriceUnit, priceUnitSuffix } from '@/utils/price-display';
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

function mealPlanDishNoticeKeys(dish: Dish, schedule?: Schedule): string[] {
  if (dish.status === 'offline' || !schedule) return [];
  const keys: string[] = [];
  if (dish.availableMealTime && !dish.availableMealTime.some(time => time === schedule.mealTime))
    keys.push('social.mealSupplyPaused');
  if (!supplyDatesCover(dish, schedule)) keys.push('social.dateSupplyPaused');
  return keys;
}

export function mealPlanDishNotices(dish: Dish, schedule?: Schedule): string[] {
  return mealPlanDishNoticeKeys(dish, schedule).map(key => t(key));
}

function localMessage(messageKey: string, messageParams?: Record<string, string | number>) {
  return { messageKey, messageParams, message: t(messageKey, messageParams) };
}

type PriceNotice = Extract<MealPlanChangeNotice, { kind: 'price' }>;

export function mealPlanPreviousPriceLabel(notice: PriceNotice): string {
  const price = notice.priceChange;
  return price
    ? `¥${price.previousPrice.toFixed(2)}${priceUnitSuffix(price.previousUnit)}`
    : notice.previousPriceLabel;
}

export function mealPlanNoticeMessage(notice: MealPlanChangeNotice): string {
  if (!notice.messageKey) return notice.message;
  if (notice.kind === 'price' && notice.priceChange) {
    const price = notice.priceChange;
    const previous = mealPlanPreviousPriceLabel(notice);
    const current = `¥${price.currentPrice.toFixed(2)}${priceUnitSuffix(price.currentUnit)}`;
    return t(
      notice.messageKey,
      notice.unitChanged
        ? { p0: previous, p1: current }
        : {
            p0: previous,
            p1: t(
              price.currentPrice > price.previousPrice
                ? 'social.priceIncreased'
                : 'social.priceDecreased'
            ),
            p2: current,
          }
    );
  }
  return t(notice.messageKey, notice.messageParams);
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
      const previousUnit = normalizePriceUnit(before.priceUnit);
      const currentUnit = normalizePriceUnit(dish.priceUnit);
      const unitChanged = previousUnit !== currentUnit;
      const priceChanged = Math.round(before.price * 100) !== Math.round(dish.price * 100);
      if (unitChanged || priceChanged) {
        const notice: PriceNotice = {
          kind: 'price',
          dishId: dish.id,
          previousPriceLabel: `¥${before.price.toFixed(2)}${priceUnitSuffix(previousUnit)}`,
          unitChanged,
          priceChange: {
            previousPrice: before.price,
            currentPrice: dish.price,
            previousUnit,
            currentUnit,
          },
          messageKey: unitChanged ? 'social.pricingUnitChanged' : 'social.unitPriceChanged',
          message: '',
        };
        notice.message = mealPlanNoticeMessage(notice);
        notices.push(notice);
      }
    }
    if (dish.status === 'offline')
      notices.push({ kind: 'status', dishId: dish.id, ...localMessage('social.unavailable') });
    const supply = mealPlanDishNoticeKeys(dish, schedule);
    notices.push(
      ...supply.map(key => ({ kind: 'supply' as const, dishId: dish.id, ...localMessage(key) }))
    );
    if (dish.status !== 'offline' && !supply.length && before) {
      if (before.status === 'offline' && dish.status === 'online')
        notices.push({ kind: 'status', dishId: dish.id, ...localMessage('social.supplyRestored') });
      else if (
        (before.availableMealTime &&
          JSON.stringify([...before.availableMealTime].sort()) !==
            JSON.stringify([...(dish.availableMealTime || [])].sort())) ||
        (before.availableDates !== undefined &&
          JSON.stringify(supplyRanges(before)) !== JSON.stringify(supplyRanges(dish)))
      )
        notices.push({ kind: 'supply', dishId: dish.id, ...localMessage('social.supplyUpdated') });
    }
  }
  const total = current.reduce((sum, dish) => sum + Math.round(dish.price * 100), 0);
  if (constraints?.totalBudget !== undefined && total > Math.round(constraints.totalBudget * 100))
    notices.push({
      kind: 'budget',
      ...localMessage('social.overBudget', {
        p0: (total / 100).toFixed(2),
        p1: constraints.totalBudget.toFixed(2),
      }),
    });
  return notices;
}
