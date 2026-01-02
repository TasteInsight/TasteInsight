import { useFilter } from '@/pages/index/composables/use-filter';

describe('useFilter additional branches', () => {
  it('validatePriceInput handles max invalid and min>max', () => {
    const f = useFilter();
    f.customPriceMin.value = '';
    f.customPriceMax.value = '-1';
    expect(f.validatePriceInput()).toBe(false);
    expect(f.priceError.value).toMatch(/最高价必须是非负数字/);

    f.customPriceMin.value = '10';
    f.customPriceMax.value = '5';
    expect(f.validatePriceInput()).toBe(false);
    expect(f.priceError.value).toMatch(/最低价不能大于最高价/);
  });

  it('onCustomPriceInput clears selectedPrice when custom is set', () => {
    const f = useFilter();
    f.selectedPrice.value = '10-15';
    f.customPriceMin.value = '1';
    f.onCustomPriceInput();
    expect(f.selectedPrice.value).toBe('');
  });

  it('validateRatingInput handles max invalid and min>max', () => {
    const f = useFilter();
    f.customRatingMax.value = '10';
    expect(f.validateRatingInput()).toBe(false);
    expect(f.ratingError.value).toMatch(/最高分必须在 0-5 之间/);

    f.customRatingMin.value = '4.5';
    f.customRatingMax.value = '4';
    expect(f.validateRatingInput()).toBe(false);
    expect(f.ratingError.value).toMatch(/最低分不能大于最高分/);
  });

  it('isTasteModified and hasActiveValue for taste', () => {
    const f = useFilter();
    expect(f.isTasteModified()).toBe(false);
    expect(f.hasActiveValue('taste')).toBe(false);

    f.selectedSpicyMin.value = 1;
    expect(f.isTasteModified()).toBe(true);
    expect(f.hasActiveValue('taste')).toBe(true);
  });

  it('hasActiveValue returns false for unknown key', () => {
    const f = useFilter();
    expect(f.hasActiveValue('unknown')).toBe(false);
  });

  it('saveCurrentState and restoreOriginalState for price and rating', () => {
    const f = useFilter();
    f.selectedPrice.value = '10-15';
    f.customPriceMin.value = '1';
    f.customPriceMax.value = '2';
    f.toggleFilter('price');
    // change values
    f.selectedPrice.value = '20-999';
    f.toggleFilter('price'); // this will save state and open then close
    f.closeFilterPanel();
    // when closed, the state restored
    f.toggleFilter('price');
    f.closeFilterPanel();

    // rating
    f.selectedRating.value = 4.5;
    f.customRatingMin.value = '3';
    f.toggleFilter('rating');
    f.selectedRating.value = 0;
    f.closeFilterPanel();
  });

  it('applyFilter respects taste/rating/price boundaries and clears activeFilter', () => {
    const f = useFilter();
    f.customPriceMin.value = '2';
    f.customPriceMax.value = '8';
    f.customRatingMin.value = '3';
    f.customRatingMax.value = '4';
    f.selectedSpicyMin.value = 1;
    f.selectedSpicyMax.value = 0; // will result in min applied
    f.activeFilter.value = 'price';

    const params = f.applyFilter();
    expect(params).toBeTruthy();
    expect(params!.price).toEqual({ min: 2, max: 8 });
    expect(params!.rating).toEqual({ min: 3, max: 4 });
    expect(params!.spicyLevel).toBeDefined();
    expect(f.activeFilter.value).toBe('');
  });
});