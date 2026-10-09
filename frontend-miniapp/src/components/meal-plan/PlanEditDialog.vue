<template>
  <view v-if="visible" class="plan-overlay" @touchmove.stop.prevent @tap="handleClose">
    <view
      class="plan-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="isEdit ? '编辑规划' : '加入这一餐'"
      @tap.stop
      @touchmove.stop
    >
      <view class="plan-header">
        <text class="plan-title">{{
          isEdit ? '编辑规划' : initialDishes?.length ? '加入这一餐' : '新建规划'
        }}</text>
        <button
          class="plan-button plan-close"
          aria-label="关闭规划"
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
              <text class="plan-label">用餐日期</text>
              <button
                class="plan-button plan-text-button"
                :aria-expanded="multiDay"
                data-testid="plan-multi-day"
                @tap="toggleMultiDay"
              >
                {{ multiDay ? '改为单日' : '安排多日' }}
              </button>
            </view>
            <view class="plan-date-row">
              <picker
                class="plan-date"
                mode="date"
                :value="formData.startDate"
                @change="onStartDateChange"
              >
                <view class="plan-field"
                  ><text class="plan-hint">{{ multiDay ? '开始日期' : '日期' }}</text
                  ><text>{{ formData.startDate }}</text></view
                >
              </picker>
              <picker
                v-if="multiDay"
                class="plan-date"
                mode="date"
                :value="formData.endDate"
                @change="onEndDateChange"
                data-testid="plan-end-date"
              >
                <view class="plan-field"
                  ><text class="plan-hint">结束日期</text><text>{{ formData.endDate }}</text></view
                >
              </picker>
            </view>
          </view>
          <view class="plan-section">
            <text class="plan-label">餐次</text>
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
            <text v-if="!isEdit" class="plan-hint">已预选建议餐次，可以修改</text>
          </view>
          <view class="plan-section">
            <view class="plan-section-heading"
              ><text class="plan-label">这一餐的菜品</text
              ><text class="plan-hint">{{ selectedDishes.length }} 道</text></view
            >
            <text v-if="!selectedDishes.length" class="plan-empty">请选择至少一道菜品</text>
            <view v-for="dish in selectedDishes" :key="dish.id" class="plan-selected-dish">
              <view class="plan-dish-copy"
                ><text class="plan-dish-name">{{ dish.name }}</text
                ><text class="plan-hint"
                  >{{ dish.canteenName || '食堂信息暂缺'
                  }}{{ dish.windowName ? ' / ' + dish.windowName : '' }}</text
                ></view
              >
              <button
                class="plan-button plan-remove"
                :aria-label="'移除' + dish.name"
                @tap="removeDish(dish.id)"
              >
                移除
              </button>
            </view>
            <button
              class="plan-button plan-add-toggle"
              :aria-expanded="showAddDishes"
              @tap="showAddDishes = !showAddDishes"
            >
              {{ showAddDishes ? '收起菜品选择' : '添加其他菜品' }}
            </button>
          </view>
          <view v-if="showAddDishes" class="plan-section plan-picker-section">
            <view class="plan-search">
              <input
                v-model="searchKeyword"
                class="plan-search-input"
                :placeholder="selectedWindow ? '搜索当前窗口菜品' : '搜索菜名'"
                aria-label="搜索菜名"
                @confirm="handleSearch"
              />
              <button
                v-if="searchKeyword"
                class="plan-button plan-clear"
                aria-label="清空搜索"
                @tap="clearSearch"
              >
                ×
              </button>
              <button class="plan-button plan-search-button" @tap="handleSearch">搜索</button>
            </view>
            <view class="plan-date-row">
              <picker
                class="plan-date"
                mode="selector"
                :range="canteenList"
                :disabled="canteenLoading && !canteenList.length"
                range-key="name"
                @change="onCanteenChange"
                ><view class="plan-select"
                  >{{
                    selectedCanteen?.name ||
                    (canteenLoading && !canteenList.length ? '正在加载食堂…' : '全部食堂')
                  }}<text>⌄</text></view
                ></picker
              >
              <picker
                v-if="selectedCanteen"
                class="plan-date"
                mode="selector"
                :range="windowList"
                :disabled="windowLoading || !windowList.length"
                range-key="name"
                @change="onWindowChange"
                ><view class="plan-select"
                  >{{ selectedWindow?.name || (windowLoading ? '正在加载窗口…' : '全部窗口')
                  }}<text>⌄</text></view
                ></picker
              >
            </view>
            <button
              v-if="selectedCanteen"
              class="plan-button plan-text-button"
              @tap="clearLocation"
            >
              清除位置筛选
            </button>
            <view v-if="canteenError" class="plan-feedback" role="alert">
              <text>{{ canteenError }}</text>
              <button class="plan-button plan-text-button" @tap="loadCanteens">重新加载食堂</button>
            </view>
            <view v-if="windowError" class="plan-feedback" role="alert">
              <text>{{ windowError }}</text>
              <button class="plan-button plan-text-button" @tap="retryWindows">重新加载窗口</button>
            </view>
            <view v-if="dishLoading" class="plan-empty">正在加载菜品…</view>
            <view v-if="dishError" class="plan-feedback" role="alert">
              <text>{{ dishError }}</text>
              <button class="plan-button plan-text-button" @tap="retryDishPage">重新加载</button>
            </view>
            <view v-if="!dishLoading && !dishError && !dishList.length" class="plan-empty">{{
              selectedCanteen || submittedKeyword
                ? '未找到菜品，试试其他关键词或窗口'
                : '搜索菜名，或选择食堂和窗口'
            }}</view>
            <button
              v-for="dish in dishList"
              :key="dish.id"
              class="plan-button plan-result"
              :aria-pressed="isDishSelected(dish.id)"
              @tap="toggleDishSelection(dish)"
            >
              <view class="plan-dish-copy"
                ><text class="plan-dish-name">{{ dish.name }}</text
                ><text class="plan-hint"
                  >{{ dish.canteenName || '食堂信息暂缺'
                  }}{{ dish.windowName ? ' / ' + dish.windowName : '' }}</text
                ><text class="plan-hint"
                  >¥{{ dish.price }}{{ dish.priceUnit ? '/' + dish.priceUnit : '' }}</text
                ></view
              >
              <text class="plan-result-action">{{
                isDishSelected(dish.id) ? '已添加' : '添加'
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
            <view v-if="loadingMore" class="plan-empty">加载更多…</view>
            <button
              v-else-if="hasMore && !dishLoading && !dishError"
              class="plan-button plan-add-toggle"
              @tap="loadNextPage"
            >
              加载更多菜品
            </button>
            <view
              v-else-if="!dishLoading && !dishError && !hasMore && dishList.length"
              class="plan-empty"
              >没有更多菜品了</view
            >
          </view>
        </view>
      </scroll-view>
      <view class="plan-footer">
        <button class="plan-button plan-cancel" :disabled="submitting" @tap="handleClose">
          取消
        </button>
        <button
          class="plan-button plan-save"
          :class="{ 'plan-button-disabled': submitting }"
          :disabled="submitting"
          data-testid="plan-save"
          @tap="handleSubmit"
        >
          {{ submitting ? '提交中...' : '确认保存' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onScopeDispose } from 'vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useUserStore } from '@/store/modules/use-user-store';
import { getWindowList, getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import { getPreferredDishSort } from '@/utils/dish-sort';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import type { MealPlanRequest, Canteen, Window, Dish, GetDishesRequest } from '@/types/api';
import dayjs from 'dayjs';

const props = defineProps<{
  visible: boolean;
  plan: EnrichedMealPlan | null;
  submitting?: boolean;
  initialDishes?: Dish[];
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
const mealTimeOptions = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '夜宵', value: 'nightsnack' },
] as const;

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
        throw new Error(response.message || '加载食堂失败');
      items.push(...response.data.items);
      total = response.data.meta.totalPages;
    }
    canteenList.value = items;
  } catch (err) {
    if (isCurrent()) canteenError.value = err instanceof Error ? err.message : '加载食堂失败';
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
  const today = dayjs().format('YYYY-MM-DD');
  const hour = new Date().getHours();
  const suggested: NonNullable<MealPlanRequest['mealTime']> =
    hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 20 ? 'dinner' : 'nightsnack';
  const available = dishes[0]?.availableMealTime || [];
  const suggestedMeal =
    available.some(meal => meal === suggested) || available.length === 0
      ? suggested
      : mealTimeOptions.find(option => available.some(meal => meal === option.value))?.value ||
        suggested;
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
        throw new Error(response.message || '加载窗口失败');
      windowList.value = response.data.items;
      for (let page = 2; page <= response.data.meta.totalPages; page += 1) {
        const next = await getWindowList(selectedCanteen.value.id, { page, pageSize: 50 });
        if (!isCurrent()) return;
        if (next.code !== 200 || !next.data) throw new Error(next.message || '加载窗口失败');
        windowList.value = [...windowList.value, ...next.data.items];
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error('加载窗口列表失败:', err);
      windowError.value = err instanceof Error ? err.message : '加载窗口失败';
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
      throw new Error(response.message || '加载菜品失败，请重试');
    }
  } catch (err) {
    if (!isCurrent()) return;

    console.error('加载菜品失败:', err);
    dishError.value = err instanceof Error ? err.message : '加载菜品失败，请重试';
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
      '当前规划尚未保存，确定放弃修改吗？'
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
      title: '请完整填写表单',
      icon: 'none',
    });
    return;
  }
  const start = new Date(formData.value.startDate);
  const end = new Date(formData.value.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    uni.showToast({
      title: '日期格式不正确',
      icon: 'none',
    });
    return;
  }
  if (end < start) {
    uni.showToast({
      title: '结束日期不能早于开始日期',
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
  padding: 10px 12px;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
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
.plan-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}
.plan-empty {
  display: block;
  padding: 18px 0;
  font-size: 13px;
  line-height: 1.6;
  color: #667085;
}
.plan-feedback {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
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
