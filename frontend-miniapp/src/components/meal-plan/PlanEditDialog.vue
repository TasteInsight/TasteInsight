<template>
  <view v-if="visible" class="plan-overlay" @touchmove.stop.prevent @tap="handleClose">
    <view
      class="plan-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="
        isEdit
          ? t('common.plan.edit')
          : initialDishes?.length
            ? t('common.plan.join')
            : t('common.plan.create')
      "
      @tap.stop
      @touchmove.stop
    >
      <view class="plan-header">
        <text class="plan-title">{{
          isEdit
            ? t('common.plan.edit')
            : initialDishes?.length
              ? t('common.plan.join')
              : t('common.plan.create')
        }}</text>
        <button
          class="plan-button plan-close"
          :aria-label="t('common.plan.close')"
          :disabled="submitting"
          @tap="handleClose"
        >
          ×
        </button>
      </view>
      <scroll-view
        scroll-y
        :lower-threshold="80"
        @scrolltolower="handleScrollToLower"
        class="plan-scroll"
      >
        <view class="plan-form">
          <view class="plan-section">
            <view class="plan-section-heading">
              <text class="plan-label">{{ t('common.plan.diningDate') }}</text>
              <button
                class="plan-button plan-text-button"
                :aria-expanded="multiDay"
                data-testid="plan-multi-day"
                @tap="toggleMultiDay"
              >
                {{ multiDay ? t('common.plan.singleDay') : t('common.plan.multipleDays') }}
              </button>
            </view>
            <view class="plan-date-row">
              <UiPicker
                class="plan-date"
                mode="date"
                :value="formData.startDate"
                @change="onStartDateChange"
              >
                <view class="plan-field"
                  ><text class="plan-hint">{{
                    multiDay ? t('common.plan.start') : t('common.plan.date')
                  }}</text
                  ><text>{{ formData.startDate }}</text></view
                >
              </UiPicker>
              <UiPicker
                v-if="multiDay"
                class="plan-date"
                mode="date"
                :value="formData.endDate"
                @change="onEndDateChange"
                data-testid="plan-end-date"
              >
                <view class="plan-field"
                  ><text class="plan-hint">{{ t('common.plan.end') }}</text
                  ><text>{{ formData.endDate }}</text></view
                >
              </UiPicker>
            </view>
          </view>
          <view class="plan-section">
            <text class="plan-label">{{ t('common.plan.meal') }}</text>
            <view class="plan-meals">
              <button
                v-for="option in mealTimeOptions"
                :key="option.value"
                class="plan-button plan-meal"
                :class="{ 'plan-meal-selected': formData.mealTime === option.value }"
                :aria-pressed="formData.mealTime === option.value"
                @tap="selectMealTime(option.value)"
              >
                {{ option.label }}
              </button>
            </view>
            <text v-if="!isEdit" class="plan-hint">{{ t('common.plan.suggested') }}</text>
          </view>
          <view class="plan-section">
            <view class="plan-section-heading"
              ><text class="plan-label">{{ t('common.plan.dishes') }}</text
              ><text class="plan-hint">{{
                t('common.plan.dishCount', { count: selectedDishes.length })
              }}</text></view
            >
            <text v-if="!selectedDishes.length" class="plan-empty">{{
              t('common.plan.chooseDish')
            }}</text>
            <view v-for="dish in selectedDishes" :key="dish.id" class="plan-selected-dish">
              <view class="plan-dish-copy"
                ><text class="plan-dish-name">{{ localizedDishName(dish) }}</text
                ><text class="plan-hint"
                  >{{ dish.canteenName || t('common.plan.noCanteen')
                  }}{{ dish.windowName ? ' / ' + dish.windowName : '' }}</text
                ><DishNutrition :dish="dish"
              /></view>
              <button
                class="plan-button plan-remove"
                :aria-label="t('common.plan.removeDish', { name: localizedDishName(dish) })"
                @tap="removeDish(dish.id)"
              >
                {{ t('common.plan.remove') }}
              </button>
            </view>
            <button
              class="plan-button plan-add-toggle"
              :aria-expanded="showAddDishes"
              @tap="showAddDishes = !showAddDishes"
            >
              {{ showAddDishes ? t('common.plan.hidePicker') : t('common.plan.addOthers') }}
            </button>
          </view>
          <view v-if="showAddDishes" class="plan-section plan-picker-section">
            <view class="plan-search">
              <input
                v-model="searchKeyword"
                class="plan-search-input"
                :placeholder="
                  selectedWindow ? t('common.plan.searchCounter') : t('common.plan.searchDish')
                "
                :aria-label="t('common.plan.searchDish')"
                @confirm="handleSearch"
              />
              <button
                v-if="searchKeyword"
                class="plan-button plan-clear"
                :aria-label="t('common.clearSearch')"
                @tap="clearSearch"
              >
                ×
              </button>
              <button class="plan-button plan-search-button" @tap="handleSearch">
                {{ t('common.search') }}
              </button>
            </view>
            <view class="plan-location-filters">
              <UiPicker
                class="plan-location-picker"
                mode="selector"
                :range="canteenList"
                :value="selectedCanteenIndex"
                :disabled="!canteenList.length"
                range-key="name"
                :aria-label="t('common.plan.chooseCanteen')"
                @change="onCanteenChange"
                ><view class="plan-select">
                  <text class="plan-select-label">{{
                    selectedCanteen?.name ||
                    (canteenLoading && !canteenList.length
                      ? t('common.plan.loadingCanteens')
                      : t('common.plan.allCanteens'))
                  }}</text>
                  <uni-icons
                    class="plan-select-icon"
                    type="down"
                    size="14"
                    color="#667085"
                    aria-hidden="true"
                  /> </view
              ></UiPicker>
              <UiPicker
                v-if="selectedCanteen"
                class="plan-location-picker"
                mode="selector"
                :range="windowList"
                :value="selectedWindowIndex"
                :disabled="windowLoading || !windowList.length"
                range-key="name"
                :aria-label="t('common.plan.chooseCounter')"
                @change="onWindowChange"
                ><view class="plan-select">
                  <text class="plan-select-label">{{
                    selectedWindow?.name ||
                    (windowLoading
                      ? t('common.plan.loadingCounters')
                      : t('common.plan.allCounters'))
                  }}</text>
                  <uni-icons
                    class="plan-select-icon"
                    type="down"
                    size="14"
                    color="#667085"
                    aria-hidden="true"
                  /> </view
              ></UiPicker>
            </view>
            <button
              v-if="selectedCanteen"
              class="plan-button plan-text-button"
              @tap="clearLocation"
            >
              {{ t('common.plan.clearLocation') }}
            </button>
            <view v-if="canteenError" class="plan-feedback error-feedback" role="alert">
              <text class="error-feedback__message">{{ canteenError }}</text>
              <button
                class="error-feedback__action"
                hover-class="error-feedback__action--pressed"
                @tap="loadCanteens"
              >
                {{ t('common.plan.reloadCanteens') }}
              </button>
            </view>
            <view v-if="windowError" class="plan-feedback error-feedback" role="alert">
              <text class="error-feedback__message">{{ windowError }}</text>
              <button
                class="error-feedback__action"
                hover-class="error-feedback__action--pressed"
                @tap="retryWindows"
              >
                {{ t('common.plan.reloadCounters') }}
              </button>
            </view>
            <view v-if="dishLoading" class="plan-empty">{{ t('common.plan.loadingDishes') }}</view>
            <view v-if="dishError" class="plan-feedback error-feedback" role="alert">
              <text class="error-feedback__message">{{ dishError }}</text>
              <button
                class="error-feedback__action"
                hover-class="error-feedback__action--pressed"
                @tap="retryDishPage"
              >
                {{ t('common.retry') }}
              </button>
            </view>
            <view v-if="!dishLoading && !dishError && !dishList.length" class="plan-empty">{{
              selectedCanteen || submittedKeyword
                ? t('common.plan.noResults')
                : t('common.plan.searchHint')
            }}</view>
            <button
              v-for="dish in dishList"
              :key="dish.id"
              class="plan-button plan-result"
              :aria-pressed="isDishSelected(dish.id)"
              @tap="toggleDishSelection(dish)"
            >
              <view class="plan-dish-copy"
                ><text class="plan-dish-name">{{ localizedDishName(dish) }}</text
                ><text class="plan-hint"
                  >{{ dish.canteenName || t('common.plan.noCanteen')
                  }}{{ dish.windowName ? ' / ' + dish.windowName : '' }}</text
                ><text class="plan-hint"
                  >¥{{ dish.price }}{{ priceUnitSuffix(dish.priceUnit) }}</text
                ><DishNutrition :dish="dish"
              /></view>
              <text class="plan-result-action">{{
                isDishSelected(dish.id) ? t('common.plan.added') : t('common.plan.add')
              }}</text>
              <image
                v-if="dish.images?.[0] && !failedImages[dish.images[0]]"
                :key="dish.images[0]"
                :src="dish.images[0]"
                class="plan-result-image"
                mode="aspectFill"
                @error="failedImages[dish.images[0]] = true"
              />
            </button>
            <view v-if="loadingMore" class="plan-empty">{{ t('common.plan.loadingMore') }}</view>
            <button
              v-else-if="hasMore && !dishLoading && !dishError"
              class="plan-button plan-add-toggle"
              @tap="loadNextPage"
            >
              {{ t('common.plan.loadMore') }}
            </button>
            <view
              v-else-if="!dishLoading && !dishError && !hasMore && dishList.length"
              class="plan-empty"
              >{{ t('common.plan.endResults') }}</view
            >
          </view>
        </view>
      </scroll-view>
      <view class="plan-footer">
        <button class="plan-button plan-cancel" :disabled="submitting" @tap="handleClose">
          {{ t('common.cancel') }}
        </button>
        <button
          class="plan-button plan-save"
          :class="{ 'plan-button-disabled': submitting }"
          :disabled="submitting"
          data-testid="plan-save"
          @tap="handleSubmit"
        >
          {{ submitting ? t('common.plan.submitting') : t('common.plan.save') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { localizedDishName } from '@/utils/dish-localization';
import { t } from '@/i18n';

import { ref, watch, computed, onMounted, onScopeDispose } from 'vue';
import UiPicker from '@/components/UiPicker.vue';
import DishNutrition from '@/components/DishNutrition.vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useUserStore } from '@/store/modules/use-user-store';
import { getWindowList, getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import { getPreferredDishSort } from '@/utils/dish-sort';
import { priceUnitSuffix } from '@/utils/price-display';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import type { MealPlanRequest, Canteen, Window, Dish, GetDishesRequest } from '@/types/api';
import dayjs from 'dayjs';

const props = defineProps<{
  visible: boolean;
  plan: EnrichedMealPlan | null;
  submitting?: boolean;
  initialDishes?: Dish[];
  initialDate?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: MealPlanRequest];
}>();

const canteenStore = useCanteenStore();
const userStore = useUserStore();
let disposed = false;
let dialogVersion = 0;
const closePending = ref(false);
onScopeDispose(() => {
  disposed = true;
});

// 基础状态
const isEdit = computed(() => !!props.plan);

// 表单数据
const formData = ref<MealPlanRequest & { dishes: string[] }>({
  startDate: '',
  endDate: '',
  mealTime: undefined,
  dishes: [],
});

// 已选菜品的完整信息（用于显示名称）
const selectedDishes = ref<Dish[]>([]);
const multiDay = ref(false);
const showAddDishes = ref(true);
const failedImages = ref<Record<string, boolean>>({});

// 菜品选择状态
const searchKeyword = ref('');
const selectedCanteen = ref<Canteen | null>(null);
const selectedWindow = ref<Window | null>(null);
const dishLoading = ref(false);
const dishList = ref<Dish[]>([]);
const dishError = ref('');
const dishErrorIsAppend = ref(false);
const canteenError = ref('');
const canteenLoading = ref(false);
const windowError = ref('');
const windowLoading = ref(false);
const submittedKeyword = ref('');
let activeDishQuery: Omit<GetDishesRequest, 'pagination'> | null = null;
const baseline = ref('');
const formSnapshot = () =>
  JSON.stringify({ ...formData.value, dishes: [...formData.value.dishes].sort() });

// 分页状态（窗口菜品 & 搜索菜品共用）
const PAGE_SIZE = 10;
const currentPage = ref(1);
const totalPages = ref(1);
const loadingMore = ref(false);
const hasMore = computed(() => currentPage.value < totalPages.value);
const requestToken = ref(0);
let windowRequestToken = 0;
let canteenRequestToken = 0;

// 食堂和窗口列表
const canteenList = ref<Canteen[]>([...canteenStore.canteenList]);
const windowList = ref<Window[]>([]);
const selectedCanteenIndex = computed(() =>
  Math.max(
    0,
    canteenList.value.findIndex(item => item.id === selectedCanteen.value?.id)
  )
);
const selectedWindowIndex = computed(() =>
  Math.max(
    0,
    windowList.value.findIndex(item => item.id === selectedWindow.value?.id)
  )
);

const captureOwner = () => {
  const session = userStore.sessionVersion;
  const version = dialogVersion;
  return () =>
    !disposed && props.visible && version === dialogVersion && session === userStore.sessionVersion;
};

const beginDishRequest = () => {
  const token = ++requestToken.value;
  const ownsPage = captureOwner();
  return () => ownsPage() && token === requestToken.value;
};

// 用餐时间选项
const mealTimeOptions = computed(
  () =>
    [
      { label: t('common.plan.breakfast'), value: 'breakfast' },
      { label: t('common.plan.lunch'), value: 'lunch' },
      { label: t('common.plan.dinner'), value: 'dinner' },
      { label: t('common.plan.snack'), value: 'nightsnack' },
    ] as const
);

const loadCanteens = async () => {
  const token = ++canteenRequestToken;
  const ownsPage = captureOwner();
  const isCurrent = () => ownsPage() && token === canteenRequestToken;
  if (!isCurrent()) return;
  canteenLoading.value = true;
  canteenError.value = '';
  try {
    const items: Canteen[] = [];
    let total = 1;
    for (let page = 1; page <= total; page += 1) {
      const response = await getCanteenList({ page, pageSize: 50 });
      if (!isCurrent()) return;
      if (response.code !== 200 || !response.data)
        throw new Error(response.message || t('common.plan.loadCanteensFailed'));
      items.push(...response.data.items);
      total = response.data.meta.totalPages;
    }
    canteenList.value = items;
  } catch (err) {
    if (isCurrent())
      canteenError.value = err instanceof Error ? err.message : t('common.plan.loadCanteensFailed');
  } finally {
    if (isCurrent()) canteenLoading.value = false;
  }
};
onMounted(() => {
  if (props.visible) void loadCanteens();
});

const resetForm = () => {
  const plan = props.plan;
  const dishes = plan?.dishes || props.initialDishes || [];
  const today = props.initialDate || dayjs().format('YYYY-MM-DD');
  const hour = new Date().getHours();
  const suggested: NonNullable<MealPlanRequest['mealTime']> =
    hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 20 ? 'dinner' : 'nightsnack';
  const available = dishes[0]?.availableMealTime || [];
  const suggestedMeal =
    available.some(meal => meal === suggested) || available.length === 0
      ? suggested
      : mealTimeOptions.value.find(option => available.some(meal => meal === option.value))
          ?.value || suggested;
  formData.value = {
    startDate: plan ? dayjs(plan.startDate).format('YYYY-MM-DD') : today,
    endDate: plan ? dayjs(plan.endDate).format('YYYY-MM-DD') : today,
    mealTime: plan?.mealTime || suggestedMeal,
    dishes: dishes.map(dish => dish.id),
  };
  selectedDishes.value = [...dishes];
  multiDay.value = formData.value.startDate !== formData.value.endDate;
  showAddDishes.value = dishes.length === 0;
  baseline.value = formSnapshot();
};

watch([() => props.plan, () => props.initialDishes], resetForm, { immediate: true });

watch(
  () => props.visible,
  (visible, wasVisible) => {
    dialogVersion += 1;
    closePending.value = false;
    if (!visible) resetDishFilters();
    else if (!wasVisible) {
      resetForm();
      void loadCanteens();
    }
  }
);

const toggleMultiDay = () => {
  multiDay.value = !multiDay.value;
  formData.value.endDate = multiDay.value
    ? dayjs(formData.value.startDate).add(1, 'day').format('YYYY-MM-DD')
    : formData.value.startDate;
};

// 重置筛选状态
const resetDishFilters = () => {
  requestToken.value += 1;
  windowRequestToken += 1;
  canteenRequestToken += 1;
  searchKeyword.value = '';
  selectedCanteen.value = null;
  selectedWindow.value = null;
  windowList.value = [];
  dishList.value = [];
  dishLoading.value = false;
  currentPage.value = 1;
  totalPages.value = 1;
  loadingMore.value = false;
  dishError.value = '';
  canteenError.value = '';
  canteenLoading.value = false;
  windowError.value = '';
  windowLoading.value = false;
  submittedKeyword.value = '';
  activeDishQuery = null;
};

watch(() => userStore.sessionVersion, resetDishFilters, { flush: 'sync' });

// 日期选择
const onStartDateChange = (e: any) => {
  formData.value.startDate = e.detail.value;
  if (!multiDay.value) formData.value.endDate = e.detail.value;
};

const onEndDateChange = (e: any) => {
  formData.value.endDate = e.detail.value;
};

// 选择食堂
const onCanteenChange = async (e: any) => {
  const token = ++windowRequestToken;
  const ownsPage = captureOwner();
  const isCurrent = () => ownsPage() && token === windowRequestToken;
  if (!isCurrent()) return;
  requestToken.value += 1;
  const index = e.detail.value;
  selectedCanteen.value = canteenList.value[index];
  selectedWindow.value = null;
  windowList.value = [];
  windowError.value = '';
  windowLoading.value = true;
  void loadDishPage(1, false);

  if (selectedCanteen.value) {
    try {
      const response = await getWindowList(selectedCanteen.value.id, { page: 1, pageSize: 50 });
      if (!isCurrent()) return;
      if (response.code !== 200 || !response.data)
        throw new Error(response.message || t('common.plan.loadCountersFailed'));
      windowList.value = response.data.items;
      for (let page = 2; page <= response.data.meta.totalPages; page += 1) {
        const next = await getWindowList(selectedCanteen.value.id, { page, pageSize: 50 });
        if (!isCurrent()) return;
        if (next.code !== 200 || !next.data)
          throw new Error(next.message || t('common.plan.loadCountersFailed'));
        windowList.value = [...windowList.value, ...next.data.items];
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error('加载窗口列表失败:', err);
      windowError.value = err instanceof Error ? err.message : t('common.plan.loadCountersFailed');
    } finally {
      if (isCurrent()) windowLoading.value = false;
    }
  }
};

// 选择窗口并加载菜品
const onWindowChange = async (e: any) => {
  requestToken.value += 1;
  const index = e.detail.value;
  selectedWindow.value = windowList.value[index];

  if (selectedWindow.value) {
    await loadDishPage(1, false);
  }
};

// 判断菜品是否已选中
const isDishSelected = (dishId: string) => {
  return selectedDishes.value.some(d => d.id === dishId);
};

// 切换菜品选择状态
const toggleDishSelection = (dish: Dish) => {
  const index = selectedDishes.value.findIndex(d => d.id === dish.id);
  if (index >= 0) {
    selectedDishes.value.splice(index, 1);
  } else {
    selectedDishes.value.push(dish);
  }
  formData.value.dishes = selectedDishes.value.map(d => d.id);
};

// 移除已选菜品
const removeDish = (dishId: string) => {
  selectedDishes.value = selectedDishes.value.filter(d => d.id !== dishId);
  formData.value.dishes = selectedDishes.value.map(d => d.id);
};

// 选择用餐时间
const selectMealTime = (value: string) => {
  formData.value.mealTime = value as MealPlanRequest['mealTime'];
};

// 搜索菜品
const handleSearch = async () => {
  await loadDishPage(1, false);
};

const clearSearch = async () => {
  searchKeyword.value = '';
  await loadDishPage(1, false);
};

const clearLocation = async () => {
  windowRequestToken += 1;
  selectedCanteen.value = null;
  selectedWindow.value = null;
  windowList.value = [];
  windowError.value = '';
  windowLoading.value = false;
  await loadDishPage(1, false);
};

const retryWindows = () => {
  const index = canteenList.value.findIndex(canteen => canteen.id === selectedCanteen.value?.id);
  if (index >= 0) return onCanteenChange({ detail: { value: index } });
};

const loadDishPage = async (
  page: number,
  append: boolean,
  query?: Omit<GetDishesRequest, 'pagination'>
) => {
  const isCurrent = beginDishRequest();
  if (!isCurrent()) return;

  if (!append) {
    const filter: GetDishesRequest['filter'] = { includeOffline: false };
    if (selectedCanteen.value) filter.canteenId = [selectedCanteen.value.id];
    if (selectedWindow.value) filter.windowId = [selectedWindow.value.id];
    submittedKeyword.value = query?.search.keyword ?? searchKeyword.value.trim();
    activeDishQuery = query || {
      filter,
      search: { keyword: submittedKeyword.value },
      sort: getPreferredDishSort(userStore.userInfo?.settings?.displaySettings?.sortBy),
    };
  }
  loadingMore.value = append;
  dishLoading.value = !append;
  dishError.value = '';
  dishErrorIsAppend.value = append;

  try {
    const response = await getDishes({
      ...activeDishQuery!,
      pagination: { page, pageSize: PAGE_SIZE },
    });

    if (!isCurrent()) return;

    if (response.code === 200 && response.data?.items) {
      dishList.value = append ? [...dishList.value, ...response.data.items] : response.data.items;
      currentPage.value = page;
      totalPages.value = response.data.meta?.totalPages ?? page;
    } else {
      throw new Error(response.message || t('common.plan.loadDishesFailed'));
    }
  } catch (err) {
    if (!isCurrent()) return;

    console.error('加载菜品失败:', err);
    dishError.value = err instanceof Error ? err.message : t('common.plan.loadDishesFailed');
  } finally {
    if (!isCurrent()) return;
    dishLoading.value = false;
    loadingMore.value = false;
  }
};

const loadNextPage = async () => {
  if (dishLoading.value || loadingMore.value) return;
  if (!hasMore.value) return;
  if (dishError.value && !dishErrorIsAppend.value) return;

  const nextPage = currentPage.value + 1;
  await loadDishPage(nextPage, true);
};

const handleScrollToLower = async () => {
  if (!activeDishQuery || dishError.value) return;
  await loadNextPage();
};

const retryDishPage = () => (dishErrorIsAppend.value ? loadNextPage() : loadDishPage(1, false));

watch(
  () => userStore.userInfo?.settings?.displaySettings?.sortBy,
  () => {
    if (!props.visible || !activeDishQuery) return;
    void loadDishPage(1, false, {
      ...activeDishQuery,
      sort: getPreferredDishSort(userStore.userInfo?.settings?.displaySettings?.sortBy),
    });
  }
);

const handleClose = async () => {
  if (props.submitting || closePending.value) return false;
  const isCurrent = captureOwner();
  closePending.value = true;
  try {
    const confirmed = await confirmDiscardChanges(
      formSnapshot() !== baseline.value,
      t('common.plan.discard')
    );
    if (!confirmed || !isCurrent()) return false;
    emit('close');
    return true;
  } finally {
    if (isCurrent()) closePending.value = false;
  }
};

defineExpose({ requestClose: handleClose });

const handleSubmit = () => {
  if (props.submitting) return;
  if (
    !formData.value.mealTime ||
    formData.value.dishes.length === 0 ||
    !formData.value.startDate ||
    !formData.value.endDate
  ) {
    uni.showToast({
      title: t('common.plan.incomplete'),
      icon: 'none',
    });
    return;
  }
  const start = new Date(formData.value.startDate);
  const end = new Date(formData.value.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    uni.showToast({
      title: t('common.plan.invalidDate'),
      icon: 'none',
    });
    return;
  }
  if (end < start) {
    uni.showToast({
      title: t('common.plan.dateOrder'),
      icon: 'none',
    });
    return;
  }

  emit('submit', { ...formData.value, dishes: [...formData.value.dishes] });
};
</script>

<style scoped>
.plan-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 24, 39, 0.42);
  padding-top: env(safe-area-inset-top);
  box-sizing: border-box;
}
.plan-sheet {
  width: 100%;
  max-width: 600px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px 20px 0 0;
  background: #fff;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.plan-title {
  font-size: 20px;
  font-weight: 600;
}
.plan-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  min-height: 44px;
  background: transparent;
  color: inherit;
}
.plan-button::after {
  border: 0;
}
.plan-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.plan-button:active {
  opacity: 0.72;
}
.plan-close {
  width: 44px;
  font-size: 26px !important;
  color: #667085 !important;
}
.plan-scroll {
  min-height: 0;
  max-height: calc(92vh - 150px - env(safe-area-inset-bottom));
}
.plan-form {
  padding: 0 20px 20px;
}
.plan-section {
  padding-top: 20px;
}
.plan-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
}
.plan-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
}
.plan-hint {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}
.plan-text-button {
  color: #660874 !important;
  padding-left: 12px !important;
}
.plan-date-row {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.plan-date {
  flex: 1;
  min-width: 0;
}
.plan-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--field-padding);
  min-height: var(--field-min-height);
  box-sizing: border-box;
  border: 1px solid var(--field-border-color);
  border-radius: var(--field-radius);
  font-size: var(--field-font-size);
  line-height: var(--field-line-height);
}
.plan-meals {
  display: flex;
  gap: 8px;
  margin: 10px 0 6px;
}
.plan-sheet .plan-meal {
  flex: 1;
  border: 1px solid #e5e7eb;
}
.plan-sheet .plan-meal-selected {
  border-color: #660874;
  color: #660874;
  background: #fff;
  font-weight: 600;
}
.plan-selected-dish {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}
.plan-dish-copy {
  min-width: 0;
  flex: 1;
  text-align: left;
}
.plan-dish-name {
  display: block;
  font-size: 15px;
  font-weight: 500;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.plan-remove {
  color: #667085 !important;
  min-width: 44px;
}
.plan-add-toggle {
  color: #660874 !important;
  margin-top: 8px !important;
}
.plan-picker-section {
  border-top: 1px solid #e5e7eb;
  margin-top: 8px;
}
.plan-search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding-left: 12px;
}
.plan-search-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  font-size: 15px;
}
.plan-search-button {
  min-width: 52px;
  color: #660874 !important;
}
.plan-clear {
  width: 44px;
  color: #667085 !important;
}
.plan-location-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 8px;
  margin-left: -8px;
}
.plan-location-picker {
  min-width: 0;
  max-width: 100%;
}
.plan-select {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 10px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: var(--field-font-size);
  line-height: var(--field-line-height);
}
.plan-select-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan-select-icon {
  flex-shrink: 0;
}
.plan-select:active {
  background: #f4f4f5;
}
@media (hover: hover) {
  .plan-select:hover {
    background: #f4f4f5;
  }
}
.plan-empty {
  display: block;
  padding: 18px 0;
  font-size: 13px;
  line-height: 1.6;
  color: #667085;
}
.plan-sheet .plan-result {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
}
.plan-result-image {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #f7f8fa;
}
.plan-result-action {
  color: #660874;
  font-size: 13px;
  white-space: nowrap;
}
.plan-footer {
  display: flex;
  gap: 12px;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.plan-sheet .plan-cancel {
  flex: 1;
  background: #f7f8fa;
}
.plan-sheet .plan-save {
  flex: 2;
  color: #fff;
  background: #660874;
  font-weight: 600;
}
.plan-save.plan-button-disabled {
  color: #667085;
  background: #e5e7eb;
}
</style>
