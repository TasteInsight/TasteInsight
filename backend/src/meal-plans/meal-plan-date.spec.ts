import {
  campusDate,
  mealDate,
  storedMealDate,
  validateMealRange,
} from './meal-plan-date';

describe('meal plan calendar dates', () => {
  it('keeps date-only values and normalizes offset timestamps to the campus day', () => {
    expect(mealDate('2026-10-09')).toBe('2026-10-09');
    expect(mealDate('2026-10-08T16:00:00Z')).toBe('2026-10-09');
    expect(storedMealDate('2026-10-09').toISOString()).toBe(
      '2026-10-09T00:00:00.000Z',
    );
  });
  it('changes the campus day exactly at midnight', () => {
    expect(campusDate(new Date('2026-10-08T15:59:59.999Z'))).toBe('2026-10-08');
    expect(campusDate(new Date('2026-10-08T16:00:00.000Z'))).toBe('2026-10-09');
  });
  it('rejects impossible dates and reversed ranges', () => {
    expect(() => mealDate('2026-02-30')).toThrow();
    expect(() => mealDate('2026-10-09T12:00:00')).toThrow();
    expect(() => validateMealRange('2026-10-10', '2026-10-09')).toThrow();
    expect(() => validateMealRange('2026-10-09', '2026-10-09')).not.toThrow();
  });
});
