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
});
