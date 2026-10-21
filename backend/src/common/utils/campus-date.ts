import { BadRequestException } from '@nestjs/common';

export function campusDate(value: Date = new Date()): string {
  return new Date(value.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function mealDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    ) {
      return value;
    }
  } else if (
    typeof value === 'string' &&
    /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    mealDate(value.slice(0, 10));
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return campusDate(parsed);
  }
  throw new BadRequestException('请使用有效的 YYYY-MM-DD 日期');
}

export function storedMealDate(value: string): Date {
  return new Date(`${mealDate(value)}T00:00:00.000Z`);
}

export function validateMealRange(startDate: string, endDate: string): void {
  if (mealDate(endDate) < mealDate(startDate)) {
    throw new BadRequestException('结束日期不能早于开始日期');
  }
}
