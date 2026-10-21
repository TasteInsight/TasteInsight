import { mealDate } from '@/common/utils/campus-date';

/** 供应日期为闭区间并集；空配置表示每天供应。 */
export function supplyDatesCover(
  availableDates: unknown,
  startDate: string,
  endDate: string = startDate,
): boolean {
  if (
    availableDates == null ||
    (Array.isArray(availableDates) && !availableDates.length)
  )
    return true;
  if (!Array.isArray(availableDates)) return false;
  const ranges: { start: string; end: string }[] = [];
  for (const range of availableDates) {
    try {
      const start = mealDate(range?.startDate);
      const end = mealDate(range?.endDate);
      if (start <= end) ranges.push({ start, end });
    } catch {
      // 历史供应配置可能包含无效日期，仅有效区间参与供应判断。
    }
  }
  ranges.sort((a, b) => a.start.localeCompare(b.start));
  let next = startDate;
  for (const range of ranges) {
    if (range.end < next) continue;
    if (range.start > next) return false;
    if (range.end >= endDate) return true;
    const following = new Date(range.end + 'T00:00:00.000Z');
    following.setUTCDate(following.getUTCDate() + 1);
    next = following.toISOString().slice(0, 10);
  }
  return false;
}
