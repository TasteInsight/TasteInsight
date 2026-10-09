<template>
  <view class="filters">
    <scroll-view scroll-x class="filters__entrances">
      <view class="filters__primary">
        <button
          role="button"
          tabindex="0"
          @keydown="handleButtonKeydown"
          @keyup="handleButtonKeyup($event, () => openFilter(option.key))"
          @blur="clearButtonPress"
          v-for="option in filterOptions"
          :key="option.key"
          class="filter-button filter-trigger"
          :class="{ 'filter-trigger--selected': appliedGroups.has(option.key) }"
          :aria-expanded="isOpen && activeFilter === option.key"
          @click="openFilter(option.key)"
        >
          <text>{{ option.label }}</text>
          <image class="filter-chevron" src="/static/icons/chevron-down.svg" aria-hidden="true" />
        </button>
      </view>
    </scroll-view>

    <view v-if="chips.length" class="filters__applied" aria-label="已应用的筛选条件">
      <button
        role="button"
        tabindex="0"
        @keydown="handleButtonKeydown"
        @keyup="handleButtonKeyup($event, () => removeChip(chip))"
        @blur="clearButtonPress"
        v-for="chip in chips"
        :key="chip.id"
        class="filter-button filter-chip"
        :aria-label="'移除' + chip.label"
        @click="removeChip(chip)"
      >
        <text class="filter-chip__label">{{ chip.label }}</text
        ><view class="filter-chip__remove filter-close__icon" aria-hidden="true" />
      </button>
      <button
        role="button"
        tabindex="0"
        @keydown="handleButtonKeydown"
        @keyup="handleButtonKeyup($event, resetAll)"
        @blur="clearButtonPress"
        class="filter-button filter-clear"
        @click="resetAll"
      >
        清除全部
      </button>
    </view>

    <view v-if="isOpen" class="filter-overlay" @tap="closePanel" @touchmove.stop.prevent>
      <view
        ref="sheetRef"
        class="filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="筛选菜品"
        @tap.stop
        @touchmove.stop
      >
        <view class="filter-panel__header">
          <text class="filter-panel__title">筛选菜品</text>
          <button
            role="button"
            tabindex="0"
            @keydown="handleButtonKeydown"
            @keyup="handleButtonKeyup($event, closePanel)"
            @blur="clearButtonPress"
            class="filter-button filter-close"
            aria-label="关闭筛选"
            @click="closePanel"
          >
            <view class="filter-close__icon" aria-hidden="true" />
          </button>
        </view>
        <scroll-view
          scroll-y
          class="filter-scroll"
          :scroll-into-view="scrollTarget"
          :scroll-with-animation="false"
        >
          <view class="filter-panel">
            <view id="filter-group-price" class="filter-group">
              <text class="filter-group__title">预算</text>
              <view class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => selectPrice(option.value))"
                  @blur="clearButtonPress"
                  v-for="option in priceOptions"
                  :key="option.value"
                  class="filter-button filter-option"
                  :class="{
                    'filter-option--selected':
                      selectedPrice === option.value && !customPriceMin && !customPriceMax,
                  }"
                  :aria-pressed="
                    selectedPrice === option.value && !customPriceMin && !customPriceMax
                  "
                  @click="selectPrice(option.value)"
                >
                  {{ option.label }}
                </button>
              </view>
              <text class="filter-panel__label">自定义预算</text>
              <view class="filter-range">
                <input
                  v-model="customPriceMin"
                  type="number"
                  placeholder="最低价"
                  aria-label="最低价格，元"
                  class="filter-input"
                  @input="onCustomPriceInput"
                />
                <text class="filter-range__separator">至</text>
                <input
                  v-model="customPriceMax"
                  type="number"
                  placeholder="最高价"
                  aria-label="最高价格，元"
                  class="filter-input"
                  @input="onCustomPriceInput"
                />
                <text class="filter-range__unit">元</text>
              </view>
              <text v-if="priceError" class="filter-error" role="alert">{{ priceError }}</text>
            </view>

            <view id="filter-group-rating" class="filter-group">
              <text class="filter-group__title">评分</text>
              <view class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => selectRating(option.value))"
                  @blur="clearButtonPress"
                  v-for="option in ratingOptions"
                  :key="option.value"
                  class="filter-button filter-option"
                  :class="{
                    'filter-option--selected':
                      selectedRating === option.value && !customRatingMin && !customRatingMax,
                  }"
                  :aria-pressed="
                    selectedRating === option.value && !customRatingMin && !customRatingMax
                  "
                  @click="selectRating(option.value)"
                >
                  {{ option.label }}
                </button>
              </view>
              <text class="filter-panel__label">自定义评分范围</text>
              <view class="filter-range">
                <input
                  v-model="customRatingMin"
                  type="digit"
                  placeholder="最低分"
                  aria-label="最低评分"
                  class="filter-input"
                  @input="onCustomRatingInput"
                />
                <text class="filter-range__separator">至</text>
                <input
                  v-model="customRatingMax"
                  type="digit"
                  placeholder="最高分"
                  aria-label="最高评分"
                  class="filter-input"
                  @input="onCustomRatingInput"
                />
                <text class="filter-range__unit">分</text>
              </view>
              <text class="filter-panel__hint">评分范围为 0–5 分</text>
              <text v-if="ratingError" class="filter-error" role="alert">{{ ratingError }}</text>
            </view>

            <view id="filter-group-mealTime" class="filter-group">
              <text class="filter-group__title">用餐时段</text>
              <text class="filter-panel__hint">可选择多个餐时</text>
              <view class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => toggleMealTime(option.value))"
                  @blur="clearButtonPress"
                  v-for="option in mealTimeOptions"
                  :key="option.value"
                  class="filter-button filter-option"
                  :class="{ 'filter-option--selected': selectedMealTime.includes(option.value) }"
                  :aria-pressed="selectedMealTime.includes(option.value)"
                  @click="toggleMealTime(option.value)"
                >
                  {{ option.label }}
                </button>
              </view>
            </view>

            <view id="filter-group-taste" class="filter-group">
              <text class="filter-group__title">口味</text>
              <text class="filter-panel__hint"
                >0 表示不限，1–5 表示程度；每项可以只设上限或下限。</text
              >
              <view v-for="item in tasteFields" :key="item.key" class="taste-range">
                <view class="taste-range__header">
                  <text class="filter-panel__label">{{ item.label }}</text>
                  <text class="filter-panel__hint">{{
                    getTasteRangeLabel(item.key, item.min, item.max)
                  }}</text>
                </view>
                <view class="taste-range__slider">
                  <text class="taste-range__limit">最低</text>
                  <slider
                    role="slider"
                    tabindex="0"
                    :aria-valuemin="0"
                    :aria-valuemax="5"
                    :value="item.min"
                    :aria-valuenow="item.min"
                    :aria-valuetext="item.min === 0 ? '不限' : String(item.min)"
                    @keydown="onTasteKeyboardChange(item.key, $event, item.min, true)"
                    :min="0"
                    :max="5"
                    :step="1"
                    activeColor="#660874"
                    backgroundColor="#E5E7EB"
                    :block-size="24"
                    :aria-label="item.label + '下限'"
                    class="taste-range__control"
                    @change="onTasteSliderChange(item.key, $event.detail.value, true)"
                  />
                  <text class="taste-range__value">{{ item.min || '不限' }}</text>
                </view>
                <view class="taste-range__slider">
                  <text class="taste-range__limit">最高</text>
                  <slider
                    role="slider"
                    tabindex="0"
                    :aria-valuemin="0"
                    :aria-valuemax="5"
                    :value="item.max"
                    :aria-valuenow="item.max"
                    :aria-valuetext="item.max === 0 ? '不限' : String(item.max)"
                    @keydown="onTasteKeyboardChange(item.key, $event, item.max, false)"
                    :min="0"
                    :max="5"
                    :step="1"
                    activeColor="#660874"
                    backgroundColor="#E5E7EB"
                    :block-size="24"
                    :aria-label="item.label + '上限'"
                    class="taste-range__control"
                    @change="onTasteSliderChange(item.key, $event.detail.value, false)"
                  />
                  <text class="taste-range__value">{{ item.max || '不限' }}</text>
                </view>
              </view>
              <text v-if="tasteError" class="filter-error" role="alert">{{ tasteError }}</text>
            </view>

            <view id="filter-group-meat" class="filter-group">
              <text class="filter-group__title">荤素偏好</text>
              <view class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => toggleMeat(option.value))"
                  @blur="clearButtonPress"
                  v-for="option in meatOptions"
                  :key="option.value"
                  class="filter-button filter-option"
                  :class="{ 'filter-option--selected': selectedMeat.includes(option.value) }"
                  :aria-pressed="selectedMeat.includes(option.value)"
                  @click="toggleMeat(option.value)"
                >
                  {{ option.label }}
                </button>
              </view>
            </view>
            <view id="filter-group-tag" class="filter-group">
              <text class="filter-group__title">菜品标签</text>
              <view class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => toggleTag(option.value))"
                  @blur="clearButtonPress"
                  v-for="option in tagOptions"
                  :key="option.value"
                  class="filter-button filter-option"
                  :class="{ 'filter-option--selected': selectedTags.includes(option.value) }"
                  :aria-pressed="selectedTags.includes(option.value)"
                  @click="toggleTag(option.value)"
                >
                  {{ option.label }}
                </button>
              </view>
              <text class="filter-panel__label">自定义标签</text>
              <view class="filter-range">
                <input
                  v-model="customTagInput"
                  type="text"
                  placeholder="输入标签名称"
                  aria-label="自定义标签"
                  class="filter-input"
                  @confirm="addCustomTag"
                />
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, addCustomTag)"
                  @blur="clearButtonPress"
                  class="filter-button filter-add"
                  @click="addCustomTag"
                >
                  添加
                </button>
              </view>
              <view v-if="customTags.length" class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => removeCustomTag(tag))"
                  @blur="clearButtonPress"
                  v-for="tag in customTags"
                  :key="tag"
                  class="filter-button filter-chip"
                  :aria-label="'移除标签' + tag"
                  @click="removeCustomTag(tag)"
                >
                  <text class="filter-chip__label">{{ tag }}</text
                  ><view class="filter-chip__remove filter-close__icon" aria-hidden="true" />
                </button>
              </view>
            </view>

            <view id="filter-group-avoid" class="filter-group">
              <text class="filter-group__title">忌口食材</text>
              <view class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => toggleAvoid(option.value))"
                  @blur="clearButtonPress"
                  v-for="option in avoidOptions"
                  :key="option.value"
                  class="filter-button filter-option"
                  :class="{ 'filter-option--selected': selectedAvoid.includes(option.value) }"
                  :aria-pressed="selectedAvoid.includes(option.value)"
                  @click="toggleAvoid(option.value)"
                >
                  {{ option.label }}
                </button>
              </view>
              <text class="filter-panel__label">自定义忌口食材</text>
              <view class="filter-range">
                <input
                  v-model="customAvoidInput"
                  type="text"
                  placeholder="输入食材名称"
                  aria-label="自定义忌口食材"
                  class="filter-input"
                  @confirm="addCustomAvoid"
                />
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, addCustomAvoid)"
                  @blur="clearButtonPress"
                  class="filter-button filter-add"
                  @click="addCustomAvoid"
                >
                  添加
                </button>
              </view>
              <view v-if="customAvoid.length" class="filter-options">
                <button
                  role="button"
                  tabindex="0"
                  @keydown="handleButtonKeydown"
                  @keyup="handleButtonKeyup($event, () => removeCustomAvoid(item))"
                  @blur="clearButtonPress"
                  v-for="item in customAvoid"
                  :key="item"
                  class="filter-button filter-chip"
                  :aria-label="'移除忌口' + item"
                  @click="removeCustomAvoid(item)"
                >
                  <text class="filter-chip__label">{{ item }}</text
                  ><view class="filter-chip__remove filter-close__icon" aria-hidden="true" />
                </button>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="filter-panel__actions">
          <button
            role="button"
            tabindex="0"
            @keydown="handleButtonKeydown"
            @keyup="handleButtonKeyup($event, resetDraft)"
            @blur="clearButtonPress"
            class="filter-button filter-reset"
            @click="resetDraft"
          >
            重置
          </button>
          <button
            role="button"
            tabindex="0"
            @keydown="handleButtonKeydown"
            @keyup="handleButtonKeyup($event, applyFilter)"
            @blur="clearButtonPress"
            class="filter-button filter-apply"
            @click="applyFilter"
          >
            确定
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useFilter } from '../composables/use-filter';
import type { GetDishesRequest } from '@/types/api';

type Filter = GetDishesRequest['filter'];
type ChipKey =
  | 'mealTime'
  | 'price'
  | 'rating'
  | 'meatPreference'
  | 'tag'
  | 'avoidIngredients'
  | 'spicyLevel'
  | 'saltiness'
  | 'sweetness'
  | 'oiliness';
interface FilterChip {
  id: string;
  key: ChipKey;
  label: string;
  value?: string;
}

const props = withDefaults(defineProps<{ filter?: Filter }>(), { filter: () => ({}) });
const emit = defineEmits<{ (e: 'filter-change', filter: Filter): void }>();
const scrollTarget = ref('');
const sheetRef = ref<HTMLElement | { $el: HTMLElement } | null>(null);

const {
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
  onCustomPriceInput,
  onCustomRatingInput,
  addCustomTag,
  removeCustomTag,
  addCustomAvoid,
  removeCustomAvoid,
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
  applyFilter: applyFilterComposable,
  resetAllFilters,
} = useFilter();

const isOpen = computed(() => !!activeFilter.value);

const tasteRanges = [
  {
    key: 'spicy',
    field: 'spicyLevel',
    label: '辣度',
    min: selectedSpicyMin,
    max: selectedSpicyMax,
  },
  { key: 'salty', field: 'saltiness', label: '咸度', min: selectedSaltyMin, max: selectedSaltyMax },
  { key: 'sweet', field: 'sweetness', label: '甜度', min: selectedSweetMin, max: selectedSweetMax },
  { key: 'oily', field: 'oiliness', label: '油腻度', min: selectedOilyMin, max: selectedOilyMax },
] as const;
const tasteFields = computed(() =>
  tasteRanges.map(item => ({
    key: item.key,
    label: item.label,
    min: item.min.value,
    max: item.max.value,
  }))
);

watch(() => props.filter, syncAppliedFilter, { immediate: true, deep: true });

const chips = computed<FilterChip[]>(() => {
  const result: FilterChip[] = [];
  const filter = props.filter;
  for (const value of filter.mealTime || [])
    result.push({
      id: 'mealTime:' + value,
      key: 'mealTime',
      value,
      label: mealTimeOptions.find(option => option.value === value)?.label || value,
    });
  if (filter.price) {
    const { min, max } = filter.price;
    result.push({
      id: 'price',
      key: 'price',
      label: min === 0 ? max + '元以内' : max === 999 ? min + '元以上' : min + '–' + max + '元',
    });
  }
  if (filter.rating) {
    const { min, max } = filter.rating;
    result.push({
      id: 'rating',
      key: 'rating',
      label: max === 5 ? min + '分以上' : min + '–' + max + '分',
    });
  }
  for (const value of filter.meatPreference || [])
    result.push({
      id: 'meatPreference:' + value,
      key: 'meatPreference',
      value,
      label: meatOptions.find(option => option.value === value)?.label || value,
    });
  for (const value of filter.tag || [])
    result.push({ id: 'tag:' + value, key: 'tag', value, label: '标签：' + value });
  for (const value of filter.avoidIngredients || [])
    result.push({
      id: 'avoidIngredients:' + value,
      key: 'avoidIngredients',
      value,
      label: '忌口：' + value,
    });
  tasteRanges.forEach(item => {
    const range = filter[item.field];
    if (range)
      result.push({
        id: item.field,
        key: item.field,
        label: item.label + ' ' + getTasteRangeLabel(item.key, range.min, range.max),
      });
  });
  return result;
});
const appliedGroups = computed(() => {
  const keys = new Set(chips.value.map(chip => chip.key));
  const groups = new Set<string>();
  if (keys.has('price')) groups.add('price');
  if (keys.has('rating')) groups.add('rating');
  if (keys.has('mealTime')) groups.add('mealTime');
  if (keys.has('meatPreference')) groups.add('meat');
  if (keys.has('tag')) groups.add('tag');
  if (keys.has('avoidIngredients')) groups.add('avoid');
  if (tasteRanges.some(item => keys.has(item.field))) groups.add('taste');
  return groups;
});
const openFilter = async (key: string) => {
  if (!isOpen.value) {
    syncAppliedFilter(props.filter);
    toggleFilter(key);
  } else activeFilter.value = key;
  scrollTarget.value = '';
  await nextTick();
  scrollTarget.value = 'filter-group-' + key;
};
type FilterKeyboardEvent = Pick<KeyboardEvent, 'key' | 'preventDefault'>;
let pressedKey: string | null = null;
const clearButtonPress = () => {
  pressedKey = null;
};
const handleButtonKeydown = (event: FilterKeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  pressedKey = event.key;
};
const handleButtonKeyup = (event: FilterKeyboardEvent, action: () => unknown) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (pressedKey !== event.key) return;
  clearButtonPress();
  action();
};
const onTasteKeyboardChange = (
  type: string,
  event: FilterKeyboardEvent,
  current: number,
  isMin: boolean
) => {
  let value = current;
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      value = Math.min(5, current + 1);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      value = Math.max(0, current - 1);
      break;
    case 'Home':
      value = 0;
      break;
    case 'End':
      value = 5;
      break;
    default:
      return;
  }
  event.preventDefault();
  onTasteSliderChange(type, value, isMin);
};
const closePanel = () => {
  clearButtonPress();
  closeFilterPanel();
  scrollTarget.value = '';
};
// #ifdef H5
let focusOrigin: HTMLElement | null = null;
const sheetElement = () => {
  const sheet = sheetRef.value;
  return sheet instanceof HTMLElement ? sheet : sheet?.$el;
};
const handleKeyboard = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePanel();
    return;
  }
  if (event.key !== 'Tab') return;
  const controls = sheetElement()?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!controls?.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
watch(isOpen, async opened => {
  if (opened) {
    focusOrigin = document.activeElement as HTMLElement;
    document.addEventListener('keydown', handleKeyboard);
    await nextTick();
    if (isOpen.value) sheetElement()?.querySelector<HTMLElement>('.filter-close')?.focus();
  } else {
    document.removeEventListener('keydown', handleKeyboard);
    focusOrigin?.focus();
    focusOrigin = null;
  }
});
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeyboard));
// #endif
const applyFilter = () => {
  const filter = applyFilterComposable();
  if (filter === null) {
    openFilter(priceError.value ? 'price' : ratingError.value ? 'rating' : 'taste');
    return;
  }
  scrollTarget.value = '';
  emit('filter-change', filter);
};
const removeChip = (chip: FilterChip) => {
  closePanel();
  const next = { ...props.filter };
  const value = next[chip.key];
  if (Array.isArray(value)) {
    const remaining = value.filter(item => item !== chip.value);
    if (remaining.length) Object.assign(next, { [chip.key]: remaining });
    else delete next[chip.key];
  } else {
    delete next[chip.key];
  }
  emit('filter-change', next);
};
const resetAll = () => {
  closePanel();
  resetAllFilters();
  emit('filter-change', {});
};

defineExpose({ resetAllFilters: resetAll, closePanel, isOpen });
</script>

<style scoped>
.filters {
  margin: 0 0 4px;
  color: #1f2937;
}
.filter-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.45;
  box-sizing: border-box;
}
.filter-button::after {
  border: 0;
}
.filter-button:active {
  opacity: 0.7;
}
.filter-button:focus-visible,
.taste-range__control:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.filters__entrances {
  width: 100%;
}
.filters__primary {
  display: flex;
  width: max-content;
  min-width: 100%;
  border-bottom: 1px solid #e5e7eb;
}
.filter-trigger {
  flex: 1;
  gap: 4px;
  flex-shrink: 0;
  padding: 0 12px;
  white-space: nowrap;
  border-radius: 0;
}
.filter-trigger--selected {
  color: #660874;
  font-weight: 600;
}
.filter-chevron {
  width: 12px;
  height: 12px;
  opacity: 0.6;
  flex-shrink: 0;
}
.filters__applied {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-top: 8px;
}
.filter-chip {
  justify-content: space-between;
  max-width: 100%;
  min-width: 0;
  padding: 0 10px;
  background: #f4f4f5;
  color: #475467;
  font-size: 12px;
}
.filter-chip__label {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: left;
}
.filter-close__icon {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.filter-close__icon::before,
.filter-close__icon::after {
  content: '';
  position: absolute;
  top: 7px;
  left: 0;
  width: 16px;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
  transform: rotate(45deg);
}
.filter-close__icon::after {
  transform: rotate(-45deg);
}
.filter-chip__remove {
  margin-left: 8px;
  width: 12px;
  height: 12px;
  opacity: 0.7;
}
.filter-chip__remove::before,
.filter-chip__remove::after {
  top: 5px;
  width: 12px;
}
.filter-clear {
  min-width: 44px;
  color: #667085;
  font-size: 12px;
  padding: 0 8px;
}
.filter-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 24, 39, 0.42);
}
.filter-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  height: min(720px, 92%);
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 16px 16px 0 0;
  box-sizing: border-box;
  animation: filter-sheet-enter 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.filter-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.filter-panel__title {
  font-size: 18px;
  font-weight: 600;
  color: #101828;
}
.filter-close {
  width: 44px;
  padding: 0;
  color: #475467;
}
.filter-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.filter-panel {
  padding: 0 20px 24px;
}
.filter-group {
  padding: 24px 0;
  border-bottom: 1px solid #eaecf0;
  scroll-margin-top: 12px;
}
.filter-group:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.filter-group__title {
  display: block;
  margin-bottom: 12px;
  color: #101828;
  font-size: 16px;
  font-weight: 600;
}
.filter-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.filter-option {
  min-width: 0;
  padding: 8px 4px;
  background: #f4f4f5;
  border: 1px solid transparent;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.filter-option--selected {
  border-color: #660874;
  background: #660874;
  color: #fff;
}
.filter-panel__label {
  display: block;
  font-size: 13px;
  color: #475467;
  margin: 16px 0 8px;
}
.filter-panel__hint {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 8px;
}
.filter-range {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 10px;
  box-sizing: border-box;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: #1f2937;
  caret-color: #660874;
}
.filter-input::placeholder {
  color: #667085;
}
.filter-input:focus {
  border-color: #660874;
  outline: none;
}
.filter-range__separator,
.filter-range__unit {
  flex-shrink: 0;
  color: #667085;
  font-size: 12px;
}
.filter-add {
  flex-shrink: 0;
  border: 1px solid #d0d5dd;
  color: #344054;
}
.filter-range + .filter-options {
  margin-top: 8px;
}
.filter-error {
  display: block;
  color: #b42318;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 8px;
}
.taste-range {
  margin-top: 16px;
}
.taste-range__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.taste-range__header .filter-panel__label {
  margin: 0 0 4px;
  font-weight: 500;
  color: #344054;
}
.taste-range__header .filter-panel__hint {
  margin: 0;
  text-align: right;
}
.taste-range__slider {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
.taste-range__limit,
.taste-range__value {
  font-size: 12px;
  color: #667085;
  flex-shrink: 0;
}
.taste-range__value {
  width: 28px;
  text-align: right;
}
.taste-range__control {
  flex: 1;
  min-width: 0;
  margin: 0 8px;
}
.filter-panel__actions {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.filter-reset {
  flex: 1;
  background: #f4f4f5;
  color: #344054;
}
.filter-apply {
  flex: 2;
  background: #660874;
  color: #fff;
  font-weight: 600;
}
@keyframes filter-sheet-enter {
  from {
    transform: translateY(24px);
    opacity: 0.96;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .filter-sheet {
    animation: none;
  }
}
@media (hover: hover) {
  .filter-option:not(.filter-option--selected):hover,
  .filter-reset:hover,
  .filter-add:hover {
    background: #eaecf0;
  }
  .filter-trigger:hover,
  .filter-close:hover {
    background: #f9fafb;
  }
  .filter-apply:hover {
    background: #550661;
  }
}
@media (min-width: 768px) {
  .filter-trigger {
    padding: 0 16px;
  }
}
</style>
