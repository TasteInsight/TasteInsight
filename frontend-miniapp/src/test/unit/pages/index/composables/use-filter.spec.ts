import { useFilter } from '@/pages/index/composables/use-filter';

describe('use-filter composable', () => {
  test('validatePriceInput: empty inputs valid', () => {
    const f = useFilter();
    expect(f.validatePriceInput()).toBe(true);
  });

  test('validatePriceInput: negative min invalid', () => {
    const f = useFilter();
    f.customPriceMin.value = '-1';
    expect(f.validatePriceInput()).toBe(false);
    expect(f.priceError.value).toMatch(/非负/);
  });

  test('validatePriceInput: min greater than max invalid', () => {
    const f = useFilter();
    f.customPriceMin.value = '20';
    f.customPriceMax.value = '10';
    expect(f.validatePriceInput()).toBe(false);
    expect(f.priceError.value).toMatch(/不能大于/);
  });

  test('onCustomPriceInput clears selectedPrice', () => {
    const f = useFilter();
    f.selectedPrice.value = '10-15';
    f.customPriceMin.value = '5';
    f.onCustomPriceInput();
    expect(f.selectedPrice.value).toBe('');
  });

  test('validateRatingInput bounds and min>max', () => {
    const f = useFilter();
    f.customRatingMin.value = '6';
    expect(f.validateRatingInput()).toBe(false);
    expect(f.ratingError.value).toMatch(/0-5/);

    f.customRatingMin.value = '4';
    f.customRatingMax.value = '3';
    expect(f.validateRatingInput()).toBe(false);
    expect(f.ratingError.value).toMatch(/不能大于/);
  });

  test('validateTasteInput detects invalid taste ranges', () => {
    const f = useFilter();
    f.selectedSpicyMin.value = 3;
    f.selectedSpicyMax.value = 2;
    expect(f.validateTasteInput()).toBe(false);
    expect(f.tasteError.value).toMatch(/辣度/);
  });

  test('isTasteModified and getTasteRangeLabel combinations', () => {
    const f = useFilter();
    expect(f.isTasteModified()).toBe(false);
    f.selectedSweetMax.value = 2;
    expect(f.isTasteModified()).toBe(true);

    expect(f.getTasteRangeLabel('spicy', 0, 0)).toBe('不限');
    expect(f.getTasteRangeLabel('spicy', 0, 2)).toContain('最高');
    expect(f.getTasteRangeLabel('spicy', 1, 3)).toBe('微辣 - 辣');
  });

  test('custom tag/avoid add and remove', () => {
    const f = useFilter();
    f.customTagInput.value = '新标签';
    f.addCustomTag();
    expect(f.customTags.value).toContain('新标签');
    // duplicate not added
    f.customTagInput.value = '新标签';
    f.addCustomTag();
    expect(f.customTags.value.filter(t => t === '新标签').length).toBe(1);

    f.removeCustomTag('新标签');
    expect(f.customTags.value).not.toContain('新标签');

    f.customAvoidInput.value = '花生';
    f.addCustomAvoid();
    expect(f.customAvoid.value).toContain('花生');
    f.removeCustomAvoid('花生');
    expect(f.customAvoid.value).not.toContain('花生');
  });

  test('toggleFilter saves and restore state via closeFilterPanel', () => {
    const f = useFilter();
    f.selectedPrice.value = '10-15';
    f.toggleFilter('price');
    expect(f.activeFilter.value).toBe('price');
    // change selectedPrice
    f.selectedPrice.value = '20-999';
    f.closeFilterPanel();
    // restored to original value
    expect(f.selectedPrice.value).toBe('10-15');
  });

  test('applyFilter builds filter object and clears original state', () => {
    const f = useFilter();
    f.customPriceMin.value = '5';
    f.customPriceMax.value = '15';
    f.selectedMealTime.value = ['lunch'];
    f.selectedTags.value = ['招牌'];
    f.customTags.value = ['自定义'];
    f.selectedSpicyMin.value = 2;

    // open price filter (toggleFilter saves state internally)
    f.toggleFilter('price');

    const res = f.applyFilter();
    expect(res).not.toBeNull();
    expect((res as any).price).toEqual({ min: 5, max: 15 });
    expect((res as any).mealTime).toEqual(['lunch']);
    expect((res as any).tag).toEqual(['招牌', '自定义']);
    expect((res as any).spicyLevel).toBeDefined();
    // activeFilter cleared and original state deleted
    expect(f.activeFilter.value).toBe('');
  });

  test('applyFilter returns null on invalid inputs', () => {
    const f = useFilter();
    f.customPriceMin.value = 'not-a-number';
    expect(f.applyFilter()).toBeNull();
  });

  test('resetCurrentFilter and resetAllFilters clear state', () => {
    const f = useFilter();
    f.activeFilter.value = 'tag';
    f.selectedTags.value = ['a'];
    f.customTags.value = ['b'];
    f.resetCurrentFilter();
    expect(f.selectedTags.value).toEqual([]);

    f.selectedPrice.value = '10-15';
    f.selectedRating.value = 4.5 as any;
    const out = f.resetAllFilters();
    expect(out).toEqual({});
    expect(f.selectedPrice.value).toBe('');
    expect(f.selectedRating.value).toBe(0);
  });
});