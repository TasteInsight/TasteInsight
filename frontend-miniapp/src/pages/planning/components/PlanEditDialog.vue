<template>
  <!-- 1. 最外层遮罩：全屏覆盖，高层级，拦截触摸事件防止穿透 -->
  <view
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-1"
    @touchmove.stop.prevent
    @tap="handleClose"
  >
    <!-- 2. 弹窗主体容器：限制最大高度，圆角，白色背景 -->
    <view
      class="w-[90%] max-h-[85vh] flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl transition-all"
      @tap.stop
      @touchmove.stop
    >
      <!-- 3. 头部：固定高度，不随内容滚动 -->
      <view
        class="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-white"
      >
        <view>
          <text class="text-xl font-bold text-gray-900 block">{{
            isEdit ? '编辑规划' : '新建规划'
          }}</text>
          <text class="text-sm text-gray-500 mt-1">制定你的专属饮食计划</text>
        </view>
        <view
          class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 active:bg-gray-200 transition-colors"
          @tap="handleClose"
        >
          <text class="text-sm">✕</text>
        </view>
      </view>

      <!-- 表单内容 -->
      <scroll-view
        scroll-y
        :lower-threshold="80"
        @scrolltolower="handleScrollToLower"
        class="flex-1 w-full bg-white min-h-0"
        style="max-height: calc(85vh - 160px)"
      >
        <view class="px-6 py-6 space-y-6">
          <!-- 日期选择行 -->
          <view>
            <text class="text-sm font-semibold text-gray-700 mb-3 block pl-1">日期范围</text>
            <view class="flex gap-3">
              <view class="flex-1">
                <picker mode="date" :value="formData.startDate" @change="onStartDateChange">
                  <view
                    class="flex flex-col bg-gray-50 rounded-2xl p-3 border border-gray-100 active:border-purple-200 transition-colors"
                  >
                    <text class="text-xs text-gray-400 mb-1">开始日期</text>
                    <view class="flex items-center justify-between">
                      <text class="text-base font-medium text-gray-800">{{
                        formData.startDate || '选择日期'
                      }}</text>
                    </view>
                  </view>
                </picker>
              </view>
              <view class="flex items-center justify-center pt-4">
                <text class="text-gray-300">→</text>
              </view>
              <view class="flex-1">
                <picker mode="date" :value="formData.endDate" @change="onEndDateChange">
                  <view
                    class="flex flex-col bg-gray-50 rounded-2xl p-3 border border-gray-100 active:border-purple-200 transition-colors"
                  >
                    <text class="text-xs text-gray-400 mb-1">结束日期</text>
                    <view class="flex items-center justify-between">
                      <text class="text-base font-medium text-gray-800">{{
                        formData.endDate || '选择日期'
                      }}</text>
                    </view>
                  </view>
                </picker>
              </view>
            </view>
          </view>

          <!-- 用餐时间 -->
          <view>
            <text class="text-sm font-semibold text-gray-700 mb-3 block pl-1">用餐时段</text>
            <view class="grid grid-cols-4 gap-2">
              <view
                v-for="option in mealTimeOptions"
                :key="option.value"
                class="py-3 text-center rounded-xl text-sm font-medium transition-all duration-200 border"
                :class="
                  formData.mealTime === option.value
                    ? 'bg-ts-purple text-white border-ts-purple shadow-md shadow-purple-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                "
                @tap="selectMealTime(option.value)"
              >
                <text>{{ option.label }}</text>
              </view>
            </view>
          </view>

          <!-- 已选菜品 -->
          <view>
            <view class="flex items-center justify-between mb-3 pl-1">
              <text class="text-sm font-semibold text-gray-700">已选菜品</text>
              <view class="bg-purple-100/80 px-2.5 py-1 rounded-full">
                <text class="text-xs text-purple-700 font-semibold"
                  >{{ selectedDishes.length }} 道菜</text
                >
              </view>
            </view>

            <view
              class="bg-purple-50/40 rounded-2xl p-4 border border-purple-100/50 min-h-[80px] flex flex-col"
            >
              <view
                v-if="selectedDishes.length === 0"
                class="flex-1 flex flex-col items-center justify-center py-4"
              >
                <text class="text-sm text-gray-500">暂未选择任何菜品</text>
                <text class="text-xs text-gray-400 mt-1">请在下方添加菜品</text>
              </view>

              <view v-else class="flex flex-wrap gap-2">
                <view
                  v-for="dish in selectedDishes"
                  :key="dish.id"
                  class="flex items-center py-1.5 pl-3 pr-2 bg-white border border-purple-200/60 rounded-full shadow-sm"
                >
                  <text class="text-xs text-gray-700 font-medium">{{ dish.name }}</text>
                  <view
                    class="ml-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-50 text-red-400 active:bg-red-100 active:text-red-500 transition-colors"
                    @tap="removeDish(dish.id)"
                  >
                    <text class="text-xs font-bold">×</text>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <!-- 添加菜品区域 (集成) -->
          <view class="border-t border-gray-100 pt-6">
            <text class="text-sm font-semibold text-gray-700 mb-3 block pl-1">添加菜品</text>

            <!-- 筛选工具 -->
            <view class="space-y-3 mb-4">
              <!-- 搜索框 -->
              <view
                class="flex items-center py-2.5 px-4 bg-gray-100 rounded-full transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-200 border border-transparent"
              >
                <view class="uni-icon uni-icon-search text-gray-400 mr-2"></view>
                <input
                  v-model="searchKeyword"
                  class="flex-1 text-sm bg-transparent h-6"
                  placeholder="搜索想吃的菜品..."
                  placeholder-class="text-gray-400"
                  @confirm="handleSearch"
                />
                <view
                  v-if="searchKeyword"
                  @tap="clearSearch"
                  class="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center mr-2"
                >
                  <text class="text-white text-xs">×</text>
                </view>
                <view
                  class="px-3 py-1 bg-ts-purple text-white rounded-full text-xs font-medium active:bg-purple-700 transition-colors"
                  @tap="handleSearch"
                >
                  <text>搜索</text>
                </view>
              </view>

              <!-- 食堂和窗口选择 -->
              <view class="flex gap-3">
                <picker
                  class="flex-1"
                  mode="selector"
                  :range="canteenList"
                  range-key="name"
                  @change="onCanteenChange"
                >
                  <view
                    class="flex items-center justify-between py-2.5 px-4 bg-white border border-gray-200 rounded-xl active:bg-gray-50 transition-colors"
                  >
                    <text class="text-sm text-gray-700 truncate flex-1 font-medium">{{
                      selectedCanteen?.name || '选择食堂'
                    }}</text>
                    <text class="text-xs text-gray-400 ml-2">▼</text>
                  </view>
                </picker>

                <picker
                  v-if="selectedCanteen"
                  class="flex-1"
                  mode="selector"
                  :range="windowList"
                  range-key="name"
                  @change="onWindowChange"
                >
                  <view
                    class="flex items-center justify-between py-2.5 px-4 bg-white border border-gray-200 rounded-xl active:bg-gray-50 transition-colors"
                  >
                    <text class="text-sm text-gray-700 truncate flex-1 font-medium">{{
                      selectedWindow?.name || '选择窗口'
                    }}</text>
                    <text class="text-xs text-gray-400 ml-2">▼</text>
                  </view>
                </picker>
              </view>
            </view>

            <!-- 菜品列表 -->
            <view class="min-h-[200px]">
              <!-- 加载状态 -->
              <view
                v-if="dishLoading"
                class="flex flex-col items-center justify-center py-10 text-gray-400"
              >
                <view
                  class="w-8 h-8 border-4 border-purple-200 border-t-ts-purple rounded-full animate-spin mb-3"
                ></view>
                <text class="text-xs">正在加载...</text>
              </view>

              <!-- 空状态 -->
              <view
                v-else-if="!selectedWindow && !searchKeyword && dishList.length === 0"
                class="flex flex-col items-center justify-center py-10 text-gray-400"
              >
                <text class="text-xs text-gray-400">请选择食堂窗口或搜索菜品</text>
              </view>

              <view
                v-else-if="filteredDishList.length === 0 && dishList.length === 0"
                class="flex flex-col items-center justify-center py-10 text-gray-400"
              >
                <text class="text-xs text-gray-400">{{
                  selectedWindow ? '该窗口暂无菜品' : '未找到相关菜品'
                }}</text>
              </view>

              <!-- 列表 -->
              <view v-else class="space-y-3">
                <view
                  v-for="dish in filteredDishList"
                  :key="dish.id"
                  class="w-full flex items-center p-3 bg-white rounded-2xl border transition-all duration-200"
                  :class="
                    isDishSelected(dish.id)
                      ? 'border-ts-purple shadow-md shadow-purple-100 bg-purple-50/10'
                      : 'border-gray-100 shadow-sm'
                  "
                  @tap="toggleDishSelection(dish)"
                >
                  <!-- 菜品图片 -->
                  <view class="relative">
                    <image
                      v-if="dish.images && dish.images.length > 0"
                      :src="dish.images[0]"
                      class="w-16 h-16 rounded-xl mr-3 flex-shrink-0 bg-gray-100 object-cover"
                      mode="aspectFill"
                    />
                    <view
                      v-else
                      class="w-16 h-16 rounded-xl mr-3 flex-shrink-0 bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center border border-gray-100"
                    >
                      <text class="text-xl">🍜</text>
                    </view>
                    <view
                      v-if="isDishSelected(dish.id)"
                      class="absolute -top-2 -left-2 w-5 h-5 bg-ts-purple rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    >
                      <text class="text-white text-[10px] font-bold">✓</text>
                    </view>
                  </view>

                  <!-- 菜品信息 -->
                  <view class="flex-1 min-w-0 mr-2 py-1">
                    <text class="text-sm font-bold text-gray-800 block truncate mb-1">{{
                      dish.name
                    }}</text>
                    <view class="flex items-center justify-between">
                      <text class="text-base text-amber-600 font-bold"
                        ><text class="text-xs font-normal mr-0.5">¥</text>{{ dish.price }}</text
                      >

                      <view
                        class="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                        :class="
                          isDishSelected(dish.id)
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        "
                      >
                        {{ isDishSelected(dish.id) ? '已添加' : '添加' }}
                      </view>
                    </view>
                  </view>
                </view>

                <view
                  v-if="loadingMore"
                  class="flex flex-col items-center justify-center py-4 text-gray-400"
                >
                  <view
                    class="w-6 h-6 border-4 border-purple-200 border-t-ts-purple rounded-full animate-spin mb-2"
                  ></view>
                  <text class="text-xs">加载更多...</text>
                </view>

                <view
                  v-else-if="!hasMore && dishList.length > 0"
                  class="flex items-center justify-center py-4 text-gray-400"
                >
                  <text class="text-xs">没有更多菜品了</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 底部按钮 -->
      <view class="px-6 py-5 border-t border-gray-100 bg-white z-10">
        <view class="flex gap-4">
          <view
            class="flex-1 py-3.5 text-center bg-gray-100 rounded-2xl active:bg-gray-200 transition-colors"
            @tap="handleClose"
          >
            <text class="text-gray-600 font-medium">取消</text>
          </view>
          <view
            class="flex-1 py-3.5 text-center rounded-2xl shadow-lg shadow-purple-200 active:scale-[0.98] transition-all"
            :class="submitting ? 'bg-purple-300' : 'bg-ts-purple'"
            @tap="handleSubmit"
          >
            <text class="text-white font-bold text-base">{{
              submitting ? '提交中...' : '确认保存'
            }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { getWindowDishes } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { EnrichedMealPlan } from '../composables/use-menu-planning';
import type { MealPlanRequest, Canteen, Window, Dish, GetDishesRequest } from '@/types/api';
import dayjs from 'dayjs';

const props = defineProps<{
  visible: boolean;
  plan: EnrichedMealPlan | null;
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: MealPlanRequest];
}>();

const canteenStore = useCanteenStore();

// 基础状态
const isEdit = computed(() => !!props.plan);
const submitting = ref(false);

// 表单数据
const formData = ref<MealPlanRequest & { dishes: string[] }>({
  startDate: '',
  endDate: '',
  mealTime: undefined,
  dishes: [],
});

// 已选菜品的完整信息（用于显示名称）
const selectedDishes = ref<Dish[]>([]);

// 菜品选择状态
const searchKeyword = ref('');
const selectedCanteen = ref<Canteen | null>(null);
const selectedWindow = ref<Window | null>(null);
const dishLoading = ref(false);
const dishList = ref<Dish[]>([]);

// 分页状态（窗口菜品 & 搜索菜品共用）
const PAGE_SIZE = 10;
const currentPage = ref(1);
const totalPages = ref(1);
const loadingMore = ref(false);
const hasMore = computed(() => currentPage.value < totalPages.value);
const requestToken = ref(0);

// 食堂和窗口列表
const canteenList = computed(() => canteenStore.canteenList);
const windowList = computed(() => canteenStore.windowList);

// 用餐时间选项
const mealTimeOptions = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '夜宵', value: 'nightsnack' },
];

// 根据搜索关键词过滤菜品
const filteredDishList = computed(() => {
  if (selectedWindow.value) {
    if (!searchKeyword.value.trim()) {
      return dishList.value;
    }
    const keyword = searchKeyword.value.toLowerCase();
    return dishList.value.filter(dish => dish.name.toLowerCase().includes(keyword));
  }
  return dishList.value;
});

// 初始化加载食堂列表
onMounted(async () => {
  if (canteenStore.canteenList.length === 0) {
    try {
      await canteenStore.fetchCanteenList();
    } catch (err) {
      console.error('加载食堂列表失败:', err);
    }
  }
});

// 监听 plan 变化初始化表单
watch(
  () => props.plan,
  newPlan => {
    if (newPlan) {
      formData.value = {
        startDate: dayjs(newPlan.startDate).format('YYYY-MM-DD'),
        endDate: dayjs(newPlan.endDate).format('YYYY-MM-DD'),
        mealTime: newPlan.mealTime,
        dishes: newPlan.dishes.map(d => d.id),
      };
      selectedDishes.value = [...newPlan.dishes];
    } else {
      formData.value = {
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        mealTime: undefined,
        dishes: [],
      };
      selectedDishes.value = [];
    }
  },
  { immediate: true }
);

// 监听 visible 变化重置状态
watch(
  () => props.visible,
  (newVisible, oldVisible) => {
    if (!newVisible) {
      resetDishFilters();
    } else if (newVisible && !oldVisible && !props.plan) {
      resetForm();
    }
  }
);

// 重置表单
const resetForm = () => {
  formData.value = {
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    mealTime: undefined,
    dishes: [],
  };
  selectedDishes.value = [];
};

// 重置筛选状态
const resetDishFilters = () => {
  searchKeyword.value = '';
  selectedCanteen.value = null;
  selectedWindow.value = null;
  dishList.value = [];
  currentPage.value = 1;
  totalPages.value = 1;
  loadingMore.value = false;
};

// 日期选择
const onStartDateChange = (e: any) => {
  formData.value.startDate = e.detail.value;
};

const onEndDateChange = (e: any) => {
  formData.value.endDate = e.detail.value;
};

// 选择食堂
const onCanteenChange = async (e: any) => {
  const index = e.detail.value;
  selectedCanteen.value = canteenList.value[index];
  selectedWindow.value = null;
  dishList.value = [];
  currentPage.value = 1;
  totalPages.value = 1;
  loadingMore.value = false;

  if (selectedCanteen.value) {
    try {
      await canteenStore.fetchWindowList(selectedCanteen.value.id, { page: 1, pageSize: 50 });
    } catch (err) {
      console.error('加载窗口列表失败:', err);
    }
  }
};

// 选择窗口并加载菜品
const onWindowChange = async (e: any) => {
  const index = e.detail.value;
  selectedWindow.value = windowList.value[index];
  dishList.value = [];
  currentPage.value = 1;
  totalPages.value = 1;
  loadingMore.value = false;

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
  if (selectedWindow.value) {
    return;
  }

  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    dishList.value = [];
    currentPage.value = 1;
    totalPages.value = 1;
    loadingMore.value = false;
    return;
  }

  currentPage.value = 1;
  totalPages.value = 1;
  loadingMore.value = false;
  await loadDishPage(1, false);
};

const clearSearch = async () => {
  searchKeyword.value = '';
  dishList.value = [];
  currentPage.value = 1;
  totalPages.value = 1;
  loadingMore.value = false;
};

const loadDishPage = async (page: number, append: boolean) => {
  const token = ++requestToken.value;

  if (append) {
    loadingMore.value = true;
  } else {
    dishLoading.value = true;
  }

  try {
    let response:
      | Awaited<ReturnType<typeof getWindowDishes>>
      | Awaited<ReturnType<typeof getDishes>>;

    if (selectedWindow.value) {
      response = await getWindowDishes(selectedWindow.value.id, { page, pageSize: PAGE_SIZE });
    } else {
      const keyword = searchKeyword.value.trim();
      if (!keyword) {
        dishList.value = [];
        currentPage.value = 1;
        totalPages.value = 1;
        return;
      }

      const params: GetDishesRequest = {
        filter: {},
        isSuggestion: false,
        search: {
          keyword,
        },
        sort: {},
        pagination: {
          page,
          pageSize: PAGE_SIZE,
        },
      };

      if (selectedCanteen.value) {
        params.filter.canteenId = [selectedCanteen.value.id];
      }

      response = await getDishes(params);
    }

    if (token !== requestToken.value) return;

    if (response.code === 200 && response.data?.items) {
      dishList.value = append ? [...dishList.value, ...response.data.items] : response.data.items;
      currentPage.value = page;
      totalPages.value = response.data.meta?.totalPages ?? page;
    } else {
      if (!append) {
        dishList.value = [];
      }
      totalPages.value = page;
    }
  } catch (err) {
    if (token !== requestToken.value) return;

    console.error('加载菜品失败:', err);
    if (!append) {
      uni.showToast({
        title: '加载失败，请重试',
        icon: 'none',
      });
      dishList.value = [];
    }
    totalPages.value = page;
  } finally {
    if (token !== requestToken.value) return;
    dishLoading.value = false;
    loadingMore.value = false;
  }
};

const loadNextPage = async () => {
  if (dishLoading.value || loadingMore.value) return;
  if (!hasMore.value) return;

  const nextPage = currentPage.value + 1;
  await loadDishPage(nextPage, true);
};

const handleScrollToLower = async () => {
  // 仅在“窗口已选”或“关键词搜索中”时触发分页加载
  const hasActiveQuery = !!selectedWindow.value || !!searchKeyword.value.trim();
  if (!hasActiveQuery) return;
  await loadNextPage();
};

const handleClose = () => {
  emit('close');
};

const handleSubmit = async () => {
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

  submitting.value = true;
  try {
    emit('submit', formData.value);
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
/* 底部安全区域 - UniApp 小程序需要 */
.pb-safe {
  padding-bottom: calc(12px + constant(safe-area-inset-bottom));
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}

/* 淡入动画 */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>
