import { ref, type Ref } from 'vue';
import type { GetDishesRequest } from '@/types/api';

export const useFilter = () => {
  const filterOptions = [
    { key: 'price', label: '预算' },
    { key: 'rating', label: '评分' },
    { key: 'mealTime', label: '餐时' },
    { key: 'taste', label: '口味' },
    { key: 'meat', label: '荤素' },
    { key: 'tag', label: '标签' },
    { key: 'avoid', label: '忌口' },
  ];

  const priceOptions = [
    { label: '不限', value: '' },
    { label: '10元以下', value: '0-10' },
    { label: '10-15元', value: '10-15' },
    { label: '15-20元', value: '15-20' },
    { label: '20元以上', value: '20-999' },
  ];

  const ratingOptions = [
    { label: '不限', value: 0 },
    { label: '4.5分以上', value: 4.5 },
    { label: '4.0分以上', value: 4.0 },
    { label: '3.5分以上', value: 3.5 },
  ];

  const mealTimeOptions = [
    { label: '早餐', value: 'breakfast' },
    { label: '午餐', value: 'lunch' },
    { label: '晚餐', value: 'dinner' },
    { label: '夜宵', value: 'nightsnack' },
  ];

  const meatOptions = [
    { label: '纯素', value: '素' },
    { label: '纯荤', value: '荤' },
    { label: '荤素搭配', value: '荤素' },
    { label: '海鲜', value: '海鲜' },
  ];

  const tagOptions = [
    { label: '招牌', value: '招牌' },
    { label: '新品', value: '新品' },
    { label: '热销', value: '热销' },
    { label: '特价', value: '特价' },
    { label: '清真', value: '清真' },
    { label: '健康', value: '健康' },
  ];

  const avoidOptions = [
    { label: '葱', value: '葱' },
    { label: '姜', value: '姜' },
    { label: '蒜', value: '蒜' },
    { label: '香菜', value: '香菜' },
    { label: '辣椒', value: '辣椒' },
    { label: '花生', value: '花生' },
    { label: '牛奶', value: '牛奶' },
    { label: '鸡蛋', value: '鸡蛋' },
  ];

  const activeFilter = ref<string>('');

  let appliedFilter: GetDishesRequest['filter'] = {};
  let originalStates: Record<string, (string | number | string[])[]> = {};

  const selectedPrice = ref<string>('');
  const selectedRating = ref<number>(0);
  const selectedMealTime = ref<string[]>([]);
  const selectedMeat = ref<string[]>([]);
  const selectedTags = ref<string[]>([]);
  const selectedAvoid = ref<string[]>([]);

  const customPriceMin = ref<string>('');
  const customPriceMax = ref<string>('');
  const priceError = ref<string>('');

  const customRatingMin = ref<string>('');
  const customRatingMax = ref<string>('');
  const ratingError = ref<string>('');

  const customTagInput = ref<string>('');
  const customTags = ref<string[]>([]);

  const customAvoidInput = ref<string>('');
  const customAvoid = ref<string[]>([]);

  const tasteError = ref<string>('');

  const selectedSpicyMin = ref<number>(0);
  const selectedSpicyMax = ref<number>(0);
  const selectedSaltyMin = ref<number>(0);
  const selectedSaltyMax = ref<number>(0);
  const selectedSweetMin = ref<number>(0);
  const selectedSweetMax = ref<number>(0);
  const selectedOilyMin = ref<number>(0);
  const selectedOilyMax = ref<number>(0);

  const getTasteRangeLabel = (type: string, minVal: number, maxVal: number): string => {
    const labels: Record<string, string[]> = {
      spicy: ['', '微辣', '中辣', '辣', '很辣', '超辣'],
      salty: ['', '微咸', '适中', '偏咸', '很咸', '超咸'],
      sweet: ['', '微甜', '适中', '偏甜', '很甜', '超甜'],
      oily: ['', '少油', '适中', '偏油', '较油', '很油'],
    };

    if (minVal === 0 && maxVal === 0) return '不限';

    const minLabel = minVal === 0 ? '不限' : labels[type]?.[minVal] || String(minVal);
    const maxLabel = maxVal === 0 ? '不限' : labels[type]?.[maxVal] || String(maxVal);

    if (minVal === 0) return `最高${maxLabel}`;
    if (maxVal === 0) return `最低${minLabel}`;
    return `${minLabel} - ${maxLabel}`;
  };

  const validatePriceInput = (): boolean => {
    priceError.value = '';
    const minStr = customPriceMin.value.trim();
    const maxStr = customPriceMax.value.trim();

    if (!minStr && !maxStr) return true;

    const min = minStr ? Number(minStr) : 0;
    const max = maxStr ? Number(maxStr) : 999;

    if (minStr && (!Number.isFinite(min!) || min! < 0)) {
      priceError.value = '最低价必须是非负数字';
      return false;
    }
    if (maxStr && (!Number.isFinite(max!) || max! < 0)) {
      priceError.value = '最高价必须是非负数字';
      return false;
    }
    if (min > max) {
      priceError.value = maxStr ? '最低价不能大于最高价' : '最低价超过默认上限999元，请填写最高价';
      return false;
    }
    return true;
  };

  const onCustomPriceInput = () => {
    customPriceMin.value = String(customPriceMin.value);
    customPriceMax.value = String(customPriceMax.value);
    priceError.value = '';
    if (customPriceMin.value || customPriceMax.value) {
      selectedPrice.value = '';
    }
  };

  const validateRatingInput = (): boolean => {
    ratingError.value = '';
    const minStr = customRatingMin.value.trim();
    const maxStr = customRatingMax.value.trim();

    if (!minStr && !maxStr) return true;

    const min = minStr ? Number(minStr) : null;
    const max = maxStr ? Number(maxStr) : null;

    if (minStr && (isNaN(min!) || min! < 0 || min! > 5)) {
      ratingError.value = '最低分必须在 0-5 之间';
      return false;
    }
    if (maxStr && (isNaN(max!) || max! < 0 || max! > 5)) {
      ratingError.value = '最高分必须在 0-5 之间';
      return false;
    }
    if (min !== null && max !== null && min > max) {
      ratingError.value = '最低分不能大于最高分';
      return false;
    }
    return true;
  };

  const onCustomRatingInput = () => {
    customRatingMin.value = String(customRatingMin.value);
    customRatingMax.value = String(customRatingMax.value);
    ratingError.value = '';
    if (customRatingMin.value || customRatingMax.value) {
      selectedRating.value = 0;
    }
  };

  const validateTasteInput = (): boolean => {
    tasteError.value = '';

    if (
      selectedSpicyMin.value > 0 &&
      selectedSpicyMax.value > 0 &&
      selectedSpicyMin.value > selectedSpicyMax.value
    ) {
      tasteError.value = '辣度最大值不能小于最小值';
    } else if (
      selectedSaltyMin.value > 0 &&
      selectedSaltyMax.value > 0 &&
      selectedSaltyMin.value > selectedSaltyMax.value
    ) {
      tasteError.value = '咸度最大值不能小于最小值';
    } else if (
      selectedSweetMin.value > 0 &&
      selectedSweetMax.value > 0 &&
      selectedSweetMin.value > selectedSweetMax.value
    ) {
      tasteError.value = '甜度最大值不能小于最小值';
    } else if (
      selectedOilyMin.value > 0 &&
      selectedOilyMax.value > 0 &&
      selectedOilyMin.value > selectedOilyMax.value
    ) {
      tasteError.value = '油腻度最大值不能小于最小值';
    }

    return !tasteError.value;
  };

  const addCustomTag = () => {
    const tag = customTagInput.value.trim();
    if (tag && !customTags.value.includes(tag) && !selectedTags.value.includes(tag)) {
      customTags.value.push(tag);
      customTagInput.value = '';
    }
  };

  const removeCustomTag = (tag: string) => {
    const index = customTags.value.indexOf(tag);
    if (index > -1) {
      customTags.value.splice(index, 1);
    }
  };

  const addCustomAvoid = () => {
    const item = customAvoidInput.value.trim();
    if (item && !customAvoid.value.includes(item) && !selectedAvoid.value.includes(item)) {
      customAvoid.value.push(item);
      customAvoidInput.value = '';
    }
  };

  const removeCustomAvoid = (item: string) => {
    const index = customAvoid.value.indexOf(item);
    if (index > -1) {
      customAvoid.value.splice(index, 1);
    }
  };

  const clearTasteError = () => {
    tasteError.value = '';
  };

  const onTasteSliderChange = (type: string, value: number, isMin: boolean) => {
    clearTasteError();
    switch (type) {
      case 'spicy':
        if (isMin) {
          selectedSpicyMin.value = value;
        } else {
          selectedSpicyMax.value = value;
        }
        break;
      case 'salty':
        if (isMin) {
          selectedSaltyMin.value = value;
        } else {
          selectedSaltyMax.value = value;
        }
        break;
      case 'sweet':
        if (isMin) {
          selectedSweetMin.value = value;
        } else {
          selectedSweetMax.value = value;
        }
        break;
      case 'oily':
        if (isMin) {
          selectedOilyMin.value = value;
        } else {
          selectedOilyMax.value = value;
        }
        break;
    }
  };

  const draftGroups: Record<string, Ref<string | number | string[]>[]> = {
    price: [selectedPrice, customPriceMin, customPriceMax],
    rating: [selectedRating, customRatingMin, customRatingMax],
    mealTime: [selectedMealTime],
    meat: [selectedMeat],
    tag: [selectedTags, customTags, customTagInput],
    avoid: [selectedAvoid, customAvoid, customAvoidInput],
    taste: [
      selectedSpicyMin,
      selectedSpicyMax,
      selectedSaltyMin,
      selectedSaltyMax,
      selectedSweetMin,
      selectedSweetMax,
      selectedOilyMin,
      selectedOilyMax,
    ],
  };
  const copyValue = (value: string | number | string[]) =>
    Array.isArray(value) ? [...value] : value;
  const snapshot = () =>
    Object.fromEntries(
      Object.entries(draftGroups).map(([key, fields]) => [
        key,
        fields.map(field => copyValue(field.value)),
      ])
    );
  const restoreGroup = (key: string, values: (string | number | string[])[]) => {
    draftGroups[key].forEach((field, index) => {
      field.value = copyValue(values[index]);
    });
  };
  const clearErrors = () => {
    priceError.value = '';
    ratingError.value = '';
    tasteError.value = '';
  };
  const closeFilterPanel = () => {
    Object.entries(originalStates).forEach(([key, values]) => restoreGroup(key, values));
    originalStates = {};
    clearErrors();
    activeFilter.value = '';
  };
  const toggleFilter = (key: string) => {
    if (activeFilter.value === key) closeFilterPanel();
    else {
      if (!activeFilter.value) originalStates = snapshot();
      activeFilter.value = key;
    }
  };

  const syncAppliedFilter = (filter: GetDishesRequest['filter']) => {
    const draft = snapshot();
    const previous = appliedFilter;
    selectedPrice.value = '';
    customPriceMin.value = '';
    customPriceMax.value = '';
    if (filter.price) {
      const preset = priceOptions.find(
        option => option.value === filter.price!.min + '-' + filter.price!.max
      );
      if (preset) selectedPrice.value = preset.value;
      else {
        customPriceMin.value = String(filter.price.min);
        customPriceMax.value = String(filter.price.max);
      }
    }
    selectedRating.value = 0;
    customRatingMin.value = '';
    customRatingMax.value = '';
    if (filter.rating) {
      const preset = ratingOptions.find(
        option =>
          option.value > 0 && option.value === filter.rating!.min && filter.rating!.max === 5
      );
      if (preset) selectedRating.value = preset.value;
      else {
        customRatingMin.value = String(filter.rating.min);
        customRatingMax.value = String(filter.rating.max);
      }
    }
    selectedMealTime.value = [...(filter.mealTime || [])];
    selectedMeat.value = [...(filter.meatPreference || [])];
    selectedTags.value = (filter.tag || []).filter(value =>
      tagOptions.some(option => option.value === value)
    );
    customTags.value = (filter.tag || []).filter(
      value => !tagOptions.some(option => option.value === value)
    );
    selectedAvoid.value = (filter.avoidIngredients || []).filter(value =>
      avoidOptions.some(option => option.value === value)
    );
    customAvoid.value = (filter.avoidIngredients || []).filter(
      value => !avoidOptions.some(option => option.value === value)
    );
    customTagInput.value = '';
    customAvoidInput.value = '';
    const tasteRanges = [
      [filter.spicyLevel, selectedSpicyMin, selectedSpicyMax],
      [filter.saltiness, selectedSaltyMin, selectedSaltyMax],
      [filter.sweetness, selectedSweetMin, selectedSweetMax],
      [filter.oiliness, selectedOilyMin, selectedOilyMax],
    ] as const;
    tasteRanges.forEach(([range, min, max]) => {
      min.value = range?.min || 0;
      max.value = range?.max || 0;
    });
    clearErrors();
    if (activeFilter.value) {
      originalStates = snapshot();
      const groupFields: Record<string, (keyof GetDishesRequest['filter'])[]> = {
        price: ['price'],
        rating: ['rating'],
        mealTime: ['mealTime'],
        meat: ['meatPreference'],
        tag: ['tag'],
        avoid: ['avoidIngredients'],
        taste: ['spicyLevel', 'saltiness', 'sweetness', 'oiliness'],
      };
      Object.entries(groupFields).forEach(([key, fields]) => {
        if (
          fields.every(field => JSON.stringify(previous[field]) === JSON.stringify(filter[field]))
        )
          restoreGroup(key, draft[key]);
      });
    }
    appliedFilter = JSON.parse(JSON.stringify(filter));
  };

  const selectPrice = (value: string) => {
    selectedPrice.value = selectedPrice.value === value ? '' : value;
    customPriceMin.value = '';
    customPriceMax.value = '';
    priceError.value = '';
  };

  const selectRating = (value: number) => {
    selectedRating.value = selectedRating.value === value ? 0 : value;
    customRatingMin.value = '';
    customRatingMax.value = '';
    ratingError.value = '';
  };

  const toggleMealTime = (value: string) => {
    const index = selectedMealTime.value.indexOf(value);
    if (index === -1) {
      selectedMealTime.value.push(value);
    } else {
      selectedMealTime.value.splice(index, 1);
    }
  };

  const toggleMeat = (value: string) => {
    const index = selectedMeat.value.indexOf(value);
    if (index === -1) {
      selectedMeat.value.push(value);
    } else {
      selectedMeat.value.splice(index, 1);
    }
  };

  const toggleTag = (value: string) => {
    const index = selectedTags.value.indexOf(value);
    if (index === -1) {
      selectedTags.value.push(value);
    } else {
      selectedTags.value.splice(index, 1);
    }
  };

  const toggleAvoid = (value: string) => {
    const index = selectedAvoid.value.indexOf(value);
    if (index === -1) {
      selectedAvoid.value.push(value);
    } else {
      selectedAvoid.value.splice(index, 1);
    }
  };

  const applyFilter = (): GetDishesRequest['filter'] | null => {
    const priceValid = validatePriceInput();
    const ratingValid = validateRatingInput();
    const tasteValid = validateTasteInput();
    if (!priceValid || !ratingValid || !tasteValid) {
      return null;
    }

    const filter: GetDishesRequest['filter'] = { ...appliedFilter };
    for (const field of [
      'price',
      'rating',
      'mealTime',
      'meatPreference',
      'tag',
      'avoidIngredients',
      'spicyLevel',
      'saltiness',
      'sweetness',
      'oiliness',
    ] as const)
      delete filter[field];

    if (customPriceMin.value || customPriceMax.value) {
      const min = customPriceMin.value ? Number(customPriceMin.value) : 0;
      const max = customPriceMax.value ? Number(customPriceMax.value) : 999;
      filter.price = { min, max };
    } else if (selectedPrice.value) {
      const [min, max] = selectedPrice.value.split('-').map(Number);
      filter.price = { min, max };
    }

    if (customRatingMin.value || customRatingMax.value) {
      const min = customRatingMin.value ? Number(customRatingMin.value) : 0;
      const max = customRatingMax.value ? Number(customRatingMax.value) : 5;
      filter.rating = { min, max };
    } else if (selectedRating.value > 0) {
      filter.rating = { min: selectedRating.value, max: 5 };
    }

    if (selectedMealTime.value.length > 0) {
      filter.mealTime = [...selectedMealTime.value];
    }

    if (selectedMeat.value.length > 0) {
      filter.meatPreference = [...selectedMeat.value];
    }

    const allTags = [...selectedTags.value, ...customTags.value];
    if (allTags.length > 0) {
      filter.tag = allTags;
    }

    const allAvoid = [...selectedAvoid.value, ...customAvoid.value];
    if (allAvoid.length > 0) {
      filter.avoidIngredients = allAvoid;
    }

    if (selectedSpicyMin.value > 0 || selectedSpicyMax.value > 0) {
      filter.spicyLevel = {
        min: selectedSpicyMin.value > 0 ? selectedSpicyMin.value : 1,
        max: selectedSpicyMax.value > 0 ? selectedSpicyMax.value : 5,
      };
    }
    if (selectedSaltyMin.value > 0 || selectedSaltyMax.value > 0) {
      filter.saltiness = {
        min: selectedSaltyMin.value > 0 ? selectedSaltyMin.value : 1,
        max: selectedSaltyMax.value > 0 ? selectedSaltyMax.value : 5,
      };
    }
    if (selectedSweetMin.value > 0 || selectedSweetMax.value > 0) {
      filter.sweetness = {
        min: selectedSweetMin.value > 0 ? selectedSweetMin.value : 1,
        max: selectedSweetMax.value > 0 ? selectedSweetMax.value : 5,
      };
    }
    if (selectedOilyMin.value > 0 || selectedOilyMax.value > 0) {
      filter.oiliness = {
        min: selectedOilyMin.value > 0 ? selectedOilyMin.value : 1,
        max: selectedOilyMax.value > 0 ? selectedOilyMax.value : 5,
      };
    }

    activeFilter.value = '';
    originalStates = {};
    return filter;
  };

  const resetDraft = () => {
    selectedPrice.value = '';
    customPriceMin.value = '';
    customPriceMax.value = '';
    priceError.value = '';
    selectedRating.value = 0;
    customRatingMin.value = '';
    customRatingMax.value = '';
    ratingError.value = '';
    selectedMealTime.value = [];
    selectedMeat.value = [];
    selectedTags.value = [];
    customTags.value = [];
    customTagInput.value = '';
    selectedAvoid.value = [];
    customAvoid.value = [];
    customAvoidInput.value = '';
    selectedSpicyMin.value = 0;
    selectedSpicyMax.value = 0;
    selectedSaltyMin.value = 0;
    selectedSaltyMax.value = 0;
    selectedSweetMin.value = 0;
    selectedSweetMax.value = 0;
    selectedOilyMin.value = 0;
    selectedOilyMax.value = 0;
    tasteError.value = '';
  };

  const resetAllFilters = (): GetDishesRequest['filter'] => {
    resetDraft();
    activeFilter.value = '';
    originalStates = {};
    appliedFilter = {};
    return {};
  };

  return {
    filterOptions,
    priceOptions,
    ratingOptions,
    mealTimeOptions,
    meatOptions,
    tagOptions,
    avoidOptions,
    activeFilter,
    selectedPrice,
    selectedRating,
    selectedMealTime,
    selectedMeat,
    selectedTags,
    selectedAvoid,
    customPriceMin,
    customPriceMax,
    priceError,
    customRatingMin,
    customRatingMax,
    ratingError,
    customTagInput,
    customTags,
    customAvoidInput,
    customAvoid,
    tasteError,
    selectedSpicyMin,
    selectedSpicyMax,
    selectedSaltyMin,
    selectedSaltyMax,
    selectedSweetMin,
    selectedSweetMax,
    selectedOilyMin,
    selectedOilyMax,
    getTasteRangeLabel,
    validatePriceInput,
    onCustomPriceInput,
    validateRatingInput,
    onCustomRatingInput,
    validateTasteInput,
    addCustomTag,
    removeCustomTag,
    addCustomAvoid,
    removeCustomAvoid,
    clearTasteError,
    onTasteSliderChange,
    toggleFilter,
    closeFilterPanel,
    selectPrice,
    selectRating,
    toggleMealTime,
    toggleMeat,
    toggleTag,
    toggleAvoid,
    resetDraft,
    syncAppliedFilter,
    applyFilter,
    resetAllFilters,
  };
};
