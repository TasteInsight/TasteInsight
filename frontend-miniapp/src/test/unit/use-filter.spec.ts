import { useFilter } from '@/pages/index/composables/use-filter';

describe('useFilter', () => {
  it('should initialize with default values', () => {
    const {
      activeFilter,
      selectedPrice,
      selectedRating,
      selectedMealTime,
      selectedMeat,
      selectedTags,
      selectedAvoid,
    } = useFilter();

    expect(activeFilter.value).toBe('');
    expect(selectedPrice.value).toBe('');
    expect(selectedRating.value).toBe(0);
    expect(selectedMealTime.value).toEqual([]);
    expect(selectedMeat.value).toEqual([]);
    expect(selectedTags.value).toEqual([]);
    expect(selectedAvoid.value).toEqual([]);
  });

  it('should toggle filter panel', () => {
    const { activeFilter, toggleFilter, closeFilterPanel } = useFilter();

    toggleFilter('price');
    expect(activeFilter.value).toBe('price');

    toggleFilter('price');
    expect(activeFilter.value).toBe('');

    toggleFilter('rating');
    expect(activeFilter.value).toBe('rating');

    closeFilterPanel();
    expect(activeFilter.value).toBe('');
  });

  it('should select price', () => {
    const { selectedPrice, selectPrice, customPriceMin, customPriceMax } = useFilter();

    selectPrice('10-15');
    expect(selectedPrice.value).toBe('10-15');
    expect(customPriceMin.value).toBe('');
    expect(customPriceMax.value).toBe('');

    // Test custom price clearing
    customPriceMin.value = '5';
    selectPrice('10-15');
    expect(customPriceMin.value).toBe('');
  });

  it('should select rating', () => {
    const { selectedRating, selectRating } = useFilter();

    selectRating(4.5);
    expect(selectedRating.value).toBe(4.5);
  });

  it('should toggle array options (mealTime, meat, tag, avoid)', () => {
    const {
      selectedMealTime,
      toggleMealTime,
      selectedMeat,
      toggleMeat,
      selectedTags,
      toggleTag,
      selectedAvoid,
      toggleAvoid,
    } = useFilter();

    // Meal Time
    toggleMealTime('breakfast');
    expect(selectedMealTime.value).toContain('breakfast');
    toggleMealTime('breakfast');
    expect(selectedMealTime.value).not.toContain('breakfast');

    // Meat
    toggleMeat('素');
    expect(selectedMeat.value).toContain('素');

    // Tag
    toggleTag('新品');
    expect(selectedTags.value).toContain('新品');

    // Avoid
    toggleAvoid('葱');
    expect(selectedAvoid.value).toContain('葱');
  });

  it('should handle custom tags', () => {
    const { customTags, customTagInput, addCustomTag, removeCustomTag } = useFilter();

    customTagInput.value = 'MyTag';
    addCustomTag();
    expect(customTags.value).toContain('MyTag');
    expect(customTagInput.value).toBe('');

    // Duplicate tag
    customTagInput.value = 'MyTag';
    addCustomTag();
    expect(customTags.value.length).toBe(1);

    // Empty tag
    customTagInput.value = '   ';
    addCustomTag();
    expect(customTags.value.length).toBe(1);

    removeCustomTag('MyTag');
    expect(customTags.value).toEqual([]);
  });

  it('should reset current filter', () => {
    const {
      activeFilter,
      selectedPrice,
      resetCurrentFilter,
      selectedRating,
    } = useFilter();

    activeFilter.value = 'price';
    selectedPrice.value = '10-15';
    resetCurrentFilter();
    expect(selectedPrice.value).toBe('');

    activeFilter.value = 'rating';
    selectedRating.value = 4.5;
    resetCurrentFilter();
    expect(selectedRating.value).toBe(0);
  });

  it('should reset all filters', () => {
    const {
      selectedPrice,
      selectedRating,
      selectedMealTime,
      resetAllFilters,
    } = useFilter();

    selectedPrice.value = '10-15';
    selectedRating.value = 4.5;
    selectedMealTime.value = ['breakfast'];

    resetAllFilters();

    expect(selectedPrice.value).toBe('');
    expect(selectedRating.value).toBe(0);
    expect(selectedMealTime.value).toEqual([]);
  });

  it('should apply filter and return correct params', () => {
    const {
      selectedPrice,
      selectedRating,
      selectedMealTime,
      selectedMeat,
      selectedTags,
      selectedAvoid,
      applyFilter,
      activeFilter,
    } = useFilter();

    selectedPrice.value = '10-15';
    selectedRating.value = 4.5;
    selectedMealTime.value = ['breakfast'];
    selectedMeat.value = ['素'];
    selectedTags.value = ['新品'];
    selectedAvoid.value = ['葱'];

    const params = applyFilter();

    expect(params).toEqual(expect.objectContaining({
      price: { min: 10, max: 15 },
      rating: { min: 4.5, max: 5 },
      mealTime: ['breakfast'],
      meatPreference: ['素'],
      tag: ['新品'],
      avoidIngredients: ['葱'],
    }));
    
    expect(activeFilter.value).toBe('');
  });

  it('should handle custom price in applyFilter', () => {
    const { customPriceMin, customPriceMax, applyFilter } = useFilter();
    
    customPriceMin.value = '5';
    customPriceMax.value = '20';
    
    const params = applyFilter();
    
    expect(params).not.toBeNull();
    expect(params!.price).toEqual({ min: 5, max: 20 });
  });

  it('validate price and rating invalid cases and taste validation', () => {
    const f = useFilter();

    // price invalid
    f.customPriceMin.value = '-1';
    expect(f.validatePriceInput()).toBe(false);
    expect(f.priceError.value).toMatch(/最低价必须是非负数字/);

    // rating invalid
    f.customRatingMin.value = '6';
    expect(f.validateRatingInput()).toBe(false);
    expect(f.ratingError.value).toMatch(/最低分必须在 0-5 之间/);

    // taste invalid
    f.selectedSpicyMin.value = 4;
    f.selectedSpicyMax.value = 2;
    expect(f.validateTasteInput()).toBe(false);
    expect(f.tasteError.value).toBeTruthy();
  });

  it('custom avoids and taste label', () => {
    const f = useFilter();
    f.customAvoidInput.value = '胡椒';
    f.addCustomAvoid();
    expect(f.customAvoid.value).toContain('胡椒');

    f.removeCustomAvoid('胡椒');
    expect(f.customAvoid.value).not.toContain('胡椒');

    expect(f.getTasteRangeLabel('spicy', 0, 0)).toBe('不限');
    expect(f.getTasteRangeLabel('spicy', 0, 3)).toMatch(/最高/);
    expect(f.getTasteRangeLabel('spicy', 2, 0)).toMatch(/最低/);
    expect(f.getTasteRangeLabel('spicy', 2, 4)).toContain('-');
  });

  it('toggleFilter saves and restores original state for tag and taste', () => {
    const f = useFilter();
    f.selectedTags.value = ['招牌'];
    f.toggleFilter('tag');
    // change and restore
    f.selectedTags.value = ['新品'];
    f.closeFilterPanel();
    expect(f.selectedTags.value).toEqual(['招牌']);

    // taste save/restore
    f.toggleFilter('taste');
    const originalSpicy = f.selectedSpicyMin.value;
    f.selectedSpicyMin.value = 1;
    f.selectedSpicyMax.value = 2;
    f.selectedSpicyMin.value = 3;
    f.closeFilterPanel();
    expect(f.selectedSpicyMin.value).toBe(originalSpicy);
  });

  it('onCustomPriceInput and onCustomRatingInput clear selections and mark active value', () => {
    const f = useFilter();
    f.selectedPrice.value = '10-15';
    f.customPriceMin.value = '5';
    f.onCustomPriceInput();
    expect(f.selectedPrice.value).toBe('');
    expect(f.hasActiveValue('price')).toBe(true);

    f.selectedRating.value = 4.5;
    f.customRatingMin.value = '3';
    f.onCustomRatingInput();
    expect(f.selectedRating.value).toBe(0);
    expect(f.hasActiveValue('rating')).toBe(true);
  });

  it('applyFilter removes saved original state (via toggleFilter) and handles taste presence', () => {
    const f = useFilter();
    // use toggleFilter to ensure originalStates entry exists for 'tag'
    f.selectedTags.value = ['B'];
    f.toggleFilter('tag'); // saves original state for tag

    // change current selection and apply
    f.selectedTags.value = ['A'];
    const params = f.applyFilter();
    expect(params).not.toBeNull();
    expect(params!.tag).toEqual(['A']);
    expect(f.activeFilter.value).toBe('');

    // taste applied
    f.selectedSpicyMin.value = 2;
    f.selectedSpicyMax.value = 4;
    const params2 = f.applyFilter();
    expect(params2!.spicyLevel).toEqual({ min: 2, max: 4 });
  });
});

