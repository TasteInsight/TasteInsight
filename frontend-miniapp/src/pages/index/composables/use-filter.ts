import { t } from '@/i18n';
import { ref, type Ref } from 'vue';
import type { GetDishesRequest } from '@/types/api';

export const useFilter = () => {
  const filterOptions = [
    {
      key: 'price',
      get label() {
        return t('food.budget');
      },
    },
    {
      key: 'rating',
      get label() {
        return t('food.rating');
      },
    },
    {
      key: 'mealTime',
      get label() {
        return t('food.mealTime');
      },
    },
    {
      key: 'taste',
      get label() {
        return t('food.taste');
      },
    },
    {
      key: 'meat',
      get label() {
        return t('food.meat');
      },
    },
    {
      key: 'tag',
      get label() {
        return t('food.tags');
      },
    },
    {
      key: 'avoid',
      get label() {
        return t('food.avoid2');
      },
    },
  ];

  const priceOptions = [
    {
      get label() {
        return t('food.any');
      },
      value: '',
    },
    {
      get label() {
        return t('food.under10');
      },
      value: '0-10',
    },
    {
      get label() {
        return t('food.1015');
      },
      value: '10-15',
    },
    {
      get label() {
        return t('food.1520');
      },
      value: '15-20',
    },
    {
      get label() {
        return t('food.over20');
      },
      value: '20-999',
    },
  ];

  const ratingOptions = [
    {
      get label() {
        return t('food.any');
      },
      value: 0,
    },
    {
      get label() {
        return t('food.45OrHigher');
      },
      value: 4.5,
    },
    {
      get label() {
        return t('food.40OrHigher');
      },
      value: 4.0,
    },
    {
      get label() {
        return t('food.35OrHigher');
      },
      value: 3.5,
    },
  ];

  const mealTimeOptions = [
    {
      get label() {
        return t('food.breakfast');
      },
      value: 'breakfast',
    },
    {
      get label() {
        return t('food.lunch');
      },
      value: 'lunch',
    },
    {
      get label() {
        return t('food.dinner');
      },
      value: 'dinner',
    },
    {
      get label() {
        return t('food.lateNight');
      },
      value: 'nightsnack',
    },
  ];

  const meatOptions = [
    {
      get label() {
        return t('food.vegetarian');
      },
      value: '素',
    },
    {
      get label() {
        return t('food.meatOnly');
      },
      value: '荤',
    },
    {
      get label() {
        return t('food.meatAndVegetables');
      },
      value: '荤素',
    },
    {
      get label() {
        return t('food.seafood');
      },
      value: '海鲜',
    },
  ];

  const tagOptions = [
    {
      get label() {
        return t('food.signature');
      },
      value: '招牌',
    },
    {
      get label() {
        return t('food.new');
      },
      value: '新品',
    },
    {
      get label() {
        return t('food.popular');
      },
      value: '热销',
    },
    {
      get label() {
        return t('food.specialOffer');
      },
      value: '特价',
    },
    {
      get label() {
        return t('food.halal');
      },
      value: '清真',
    },
    {
      get label() {
        return t('food.healthy');
      },
      value: '健康',
    },
  ];

  const avoidOptions = [
    {
      get label() {
        return t('food.scallion');
      },
      value: '葱',
    },
    {
      get label() {
        return t('food.ginger');
      },
      value: '姜',
    },
    {
      get label() {
        return t('food.garlic');
      },
      value: '蒜',
    },
    {
      get label() {
        return t('food.cilantro');
      },
      value: '香菜',
    },
    {
      get label() {
        return t('food.chili');
      },
      value: '辣椒',
    },
    {
      get label() {
        return t('food.peanuts');
      },
      value: '花生',
    },
    {
      get label() {
        return t('food.milk');
      },
      value: '牛奶',
    },
    {
      get label() {
        return t('food.eggs');
      },
      value: '鸡蛋',
    },
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
      spicy: [
        '',
        t('food.mildlySpicy'),
        t('food.mediumSpicy'),
        t('food.spicy'),
        t('food.verySpicy'),
        t('food.extraSpicy'),
      ],
      salty: [
        '',
        t('food.lightlySalted'),
        t('food.moderate'),
        t('food.salty'),
        t('food.verySalty'),
        t('food.extraSalty'),
      ],
      sweet: [
        '',
        t('food.lightlySweet'),
        t('food.moderate'),
        t('food.sweet'),
        t('food.verySweet'),
        t('food.extraSweet'),
      ],
      oily: [
        '',
        t('food.lowOil'),
        t('food.moderate'),
        t('food.oily'),
        t('food.quiteOily'),
        t('food.veryOily'),
      ],
    };

    if (minVal === 0 && maxVal === 0) return t('food.any');

    const minLabel = minVal === 0 ? t('food.any') : labels[type]?.[minVal] || String(minVal);
    const maxLabel = maxVal === 0 ? t('food.any') : labels[type]?.[maxVal] || String(maxVal);

    if (minVal === 0) return t('food.atMostValue', { value: maxLabel });
    if (maxVal === 0) return t('food.atLeastValue', { value: minLabel });
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
      priceError.value = t('food.enterAMinimumPriceOfZeroOrMore');
      return false;
    }
    if (maxStr && (!Number.isFinite(max!) || max! < 0)) {
      priceError.value = t('food.enterAMaximumPriceOfZeroOrMore');
      return false;
    }
    if (min > max) {
      priceError.value = maxStr
        ? t('food.minimumPriceMustBeAtMostTheMaximum')
        : t('food.enterAMaximumPriceWhenTheMinimumExceeds');
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
      ratingError.value = t('food.minimumRatingMustBeBetween0And5');
      return false;
    }
    if (maxStr && (isNaN(max!) || max! < 0 || max! > 5)) {
      ratingError.value = t('food.maximumRatingMustBeBetween0And5');
      return false;
    }
    if (min !== null && max !== null && min > max) {
      ratingError.value = t('food.minimumRatingMustBeAtMostTheMaximum');
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
      tasteError.value = t('food.maximumSpicinessMustBeAtLeastTheMinimum');
    } else if (
      selectedSaltyMin.value > 0 &&
      selectedSaltyMax.value > 0 &&
      selectedSaltyMin.value > selectedSaltyMax.value
    ) {
      tasteError.value = t('food.maximumSaltinessMustBeAtLeastTheMinimum');
    } else if (
      selectedSweetMin.value > 0 &&
      selectedSweetMax.value > 0 &&
      selectedSweetMin.value > selectedSweetMax.value
    ) {
      tasteError.value = t('food.maximumSweetnessMustBeAtLeastTheMinimum');
    } else if (
      selectedOilyMin.value > 0 &&
      selectedOilyMax.value > 0 &&
      selectedOilyMin.value > selectedOilyMax.value
    ) {
      tasteError.value = t('food.maximumOilinessMustBeAtLeastTheMinimum');
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
