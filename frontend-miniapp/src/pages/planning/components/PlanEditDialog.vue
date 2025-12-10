<template>
  <!-- 1. 最外层遮罩：全屏覆盖，高层级，拦截触摸事件防止穿透 -->
  <view 
    v-if="visible" 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @touchmove.stop.prevent="() => {}"
    @tap="handleClose"
  >
    <!-- 2. 弹窗主体容器：限制最大高度，圆角，白色背景 -->
    <view 
      class="w-[90%] max-h-[85vh] flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl transition-all"
      @tap.stop
      @touchmove.stop
    >
      
      <!-- 3. 头部：固定高度，不随内容滚动 -->
      <view class="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-white">
        <view>
          <text class="text-xl font-bold text-gray-900 block">{{ isEdit ? '编辑规划' : '新建规划' }}</text>
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
        class="flex-1 w-full bg-white min-h-0" 
        style="max-height: calc(85vh - 160px);"
      >
        <view class="px-6 py-6 space-y-6">
          <!-- 日期选择行 -->
          <view>
            <text class="text-sm font-semibold text-gray-700 mb-3 block pl-1">日期范围</text>
            <view class="flex gap-3">
              <view class="flex-1">
                <picker mode="date" :value="formData.startDate" @change="onStartDateChange">
                  <view class="flex flex-col bg-gray-50 rounded-2xl p-3 border border-gray-100 active:border-purple-200 transition-colors">
                    <text class="text-xs text-gray-400 mb-1">开始日期</text>
                    <view class="flex items-center justify-between">
                      <text class="text-base font-medium text-gray-800">{{ formData.startDate || '选择日期' }}</text>
                    </view>
                  </view>
                </picker>
              </view>
              <view class="flex items-center justify-center pt-4">
                <text class="text-gray-300">→</text>
              </view>
              <view class="flex-1">
                <picker mode="date" :value="formData.endDate" @change="onEndDateChange">
                  <view class="flex flex-col bg-gray-50 rounded-2xl p-3 border border-gray-100 active:border-purple-200 transition-colors">
                    <text class="text-xs text-gray-400 mb-1">结束日期</text>
                    <view class="flex items-center justify-between">
                      <text class="text-base font-medium text-gray-800">{{ formData.endDate || '选择日期' }}</text>
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
                :class="formData.mealTime === option.value 
                  ? 'bg-ts-purple text-white border-ts-purple shadow-md shadow-purple-200' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
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
                <text class="text-xs text-purple-700 font-semibold">{{ selectedDishes.length }} 道菜</text>
              </view>
            </view>
            
            <view class="bg-purple-50/40 rounded-2xl p-4 border border-purple-100/50 min-h-[120px] flex flex-col">
              <view v-if="selectedDishes.length === 0" class="flex-1 flex flex-col items-center justify-center py-4">
                <text class="text-sm text-gray-500">暂未选择任何菜品</text>
                <text class="text-xs text-gray-400 mt-1">点击下方按钮开始选择</text>
              </view>
              
              <view v-else class="flex flex-wrap gap-2 mb-4">
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
              
              <view 
                class="mt-auto w-full py-3 flex items-center justify-center gap-2 border-2 border-dashed border-purple-300/70 bg-white/60 rounded-xl active:bg-purple-100/50 transition-colors"
                @tap="openDishSelector"
              >
                <view class="w-5 h-5 rounded-full bg-ts-purple text-white flex items-center justify-center text-xs font-bold shadow-sm">+</view>
                <text class="text-sm text-purple-700 font-semibold">添加菜品</text>
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
            <text class="text-white font-bold text-base">{{ submitting ? '提交中...' : '确认保存' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>

  <!-- 菜品选择器 - 居中显示 -->
  <view 
    v-if="showDishSelector" 
    class="fixed inset-0 z-[1001] flex items-center justify-center p-5"
    @touchmove.stop.prevent
  >
    <!-- 遮罩层 -->
    <view 
      class="absolute inset-0 bg-black/60 backdrop-blur-sm" 
      @tap="closeDishSelector"
      @touchmove.stop.prevent
    ></view>

    <!-- 内容区域 -->
    <view 
      class="relative bg-white rounded-3xl w-full max-w-xl flex flex-col overflow-hidden shadow-2xl animate-fade-in z-10" 
      style="max-height: 85vh; min-height: 60vh;"
      @tap.stop
      @touchmove.stop
    >
      <!-- 头部 -->
      <view class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white z-10">
        <view 
          class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500" 
          @tap="closeDishSelector"
        >
          <text class="text-sm">✕</text>
        </view>
        <text class="text-lg font-bold text-gray-900">添加菜品</text>
        <view 
          class="px-4 py-1.5 rounded-full transition-all"
          :class="tempSelectedDishes.length > 0 ? 'bg-ts-purple text-white shadow-md shadow-purple-200' : 'bg-gray-100 text-gray-400'"
          @tap="confirmDishSelection"
        >
          <text class="text-sm font-medium">
            完成{{ tempSelectedDishes.length > 0 ? `(${tempSelectedDishes.length})` : '' }}
          </text>
        </view>
      </view>

      <!-- 筛选区域 -->
      <view class="px-6 py-4 bg-white border-b border-gray-100 z-10">
        <!-- 搜索框 -->
        <view class="flex items-center py-2.5 px-4 bg-gray-100 rounded-full mb-3 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-200 border border-transparent">
          <view class="uni-icon uni-icon-search text-gray-400 mr-2"></view>
          <input 
            v-model="searchKeyword" 
            class="flex-1 text-sm bg-transparent h-6"
            placeholder="搜索想吃的菜品..."
            placeholder-class="text-gray-400"
            @confirm="handleSearch"
          />
          <view v-if="searchKeyword" @tap="clearSearch" class="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center mr-2">
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
          <picker class="flex-1" mode="selector" :range="canteenList" range-key="name" @change="onCanteenChange">
            <view class="flex items-center justify-between py-2.5 px-4 bg-white border border-gray-200 rounded-xl active:bg-gray-50 transition-colors">
              <text class="text-sm text-gray-700 truncate flex-1 font-medium">{{ selectedCanteen?.name || '选择食堂' }}</text>
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
            <view class="flex items-center justify-between py-2.5 px-4 bg-white border border-gray-200 rounded-xl active:bg-gray-50 transition-colors">
              <text class="text-sm text-gray-700 truncate flex-1 font-medium">{{ selectedWindow?.name || '选择窗口' }}</text>
              <text class="text-xs text-gray-400 ml-2">▼</text>
            </view>
          </picker>
        </view>
      </view>

      <!-- 菜品列表 -->
      <scroll-view 
        scroll-y 
        class="flex-1 bg-gray-50 w-full min-h-0" 
        style="max-height: calc(85vh - 200px);"
      >
        <view class="p-4 pb-20">
          <!-- 加载状态 -->
          <view v-if="dishLoading" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <view class="w-10 h-10 border-4 border-purple-200 border-t-ts-purple rounded-full animate-spin mb-4"></view>
            <text class="text-sm">正在加载美味...</text>
          </view>
          
          <!-- 空状态 - 未选择窗口 -->
          <view v-else-if="!selectedWindow && !searchKeyword && dishList.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <text class="text-sm font-medium text-gray-500">请先选择食堂和窗口</text>
            <text class="text-xs text-gray-400 mt-1">或者直接搜索菜品名称</text>
          </view>
          
          <!-- 空状态 - 无菜品 -->
          <view v-else-if="filteredDishList.length === 0 && dishList.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <text class="text-sm font-medium text-gray-500">{{ selectedWindow ? '该窗口暂无菜品' : (searchKeyword ? '请点击搜索按钮查询' : '请输入搜索词或选择窗口') }}</text>
          </view>
          
          <!-- 空状态 - 搜索后无结果 -->
          <view v-else-if="filteredDishList.length === 0 && dishList.length > 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <text class="text-sm font-medium text-gray-500">未找到相关菜品</text>
          </view>
          
          <!-- 菜品列表 -->
          <view v-else class="space-y-3">
            <view 
              v-for="dish in filteredDishList" 
              :key="dish.id"
              class="w-full flex items-center p-3 bg-white rounded-2xl border transition-all duration-200"
              :class="isDishSelected(dish.id) ? 'border-ts-purple shadow-md shadow-purple-100 bg-purple-50/10' : 'border-gray-100 shadow-sm'"
              @tap="toggleDishSelection(dish)"
            >
              <!-- 菜品图片 -->
              <view class="relative">
                <image 
                  v-if="dish.images && dish.images.length > 0"
                  :src="dish.images[0]" 
                  class="w-20 h-20 rounded-xl mr-4 flex-shrink-0 bg-gray-100 object-cover"
                  mode="aspectFill"
                />
                <view v-else class="w-20 h-20 rounded-xl mr-4 flex-shrink-0 bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center border border-gray-100">
                  <text class="text-2xl">🍜</text>
                </view>
                <view v-if="isDishSelected(dish.id)" class="absolute -top-2 -left-2 w-6 h-6 bg-ts-purple rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  <text class="text-white text-xs font-bold">✓</text>
                </view>
              </view>
              
              <!-- 菜品信息 -->
              <view class="flex-1 min-w-0 mr-2 py-1">
                <text class="text-base font-bold text-gray-800 block truncate mb-1.5">{{ dish.name }}</text>
                <view class="flex items-center justify-between">
                  <text class="text-lg text-amber-600 font-bold"><text class="text-xs font-normal mr-0.5">¥</text>{{ dish.price }}</text>
                  
                  <!-- 选择按钮 -->
                  <view 
                    class="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    :class="isDishSelected(dish.id) 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-gray-100 text-gray-600'"
                  >
                    {{ isDishSelected(dish.id) ? '已选择' : '选择' }}
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { getWindowDishes } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { EnrichedMealPlan } from '../composables/use-menu-planning';
import type { MealPlanRequest, Canteen, Window, Dish } from '@/types/api';
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

// 菜品选择器状态
const showDishSelector = ref(false);
const searchKeyword = ref('');
const selectedCanteen = ref<Canteen | null>(null);
const selectedWindow = ref<Window | null>(null);
const dishLoading = ref(false);
const dishList = ref<Dish[]>([]);
const tempSelectedDishes = ref<Dish[]>([]);

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
  // 如果选择了窗口，则使用本地过滤（因为已经加载了该窗口的所有菜品）
  if (selectedWindow.value) {
    if (!searchKeyword.value.trim()) {
      return dishList.value;
    }
    const keyword = searchKeyword.value.toLowerCase();
    return dishList.value.filter(dish => 
      dish.name.toLowerCase().includes(keyword)
    );
  }
  
  // 如果没有选择窗口（即全局搜索或食堂内搜索），直接显示 dishList
  // 因为 dishList 已经是通过 handleSearch 从后端获取的搜索结果了
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
watch(() => props.plan, (newPlan) => {
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
}, { immediate: true });

// 返回键拦截处理函数
const handleBackPress = () => {
  // 优先关闭菜品选择器
  if (showDishSelector.value) {
    closeDishSelector();
    return true; // 阻止默认返回行为，表示已处理
  }
  // 如果菜品选择器已关闭，返回 false，让父组件处理关闭主弹窗的逻辑
  return false;
};

// 在小程序端拦截物理返回：优先关闭菜品选择器，其次关闭主弹窗
const backInterceptor = {
  invoke() {
    if (showDishSelector.value) {
      closeDishSelector();
      return false; // 阻止默认返回
    }
    if (props.visible) {
      emit('close');
      return false; // 阻止默认返回
    }
    // 明确返回 true 以允许默认返回行为（比返回 undefined 更具可读性）
    return true; // 允许默认行为
  }
};

// 暴露给父组件使用
defineExpose({
  handleBackPress
});

// 挂载/卸载拦截器
onMounted(() => {
  uni.addInterceptor('navigateBack', backInterceptor);
});

onUnmounted(() => {
  // 移除我们添加的具体拦截器，避免误删其他拦截器
  (uni as any).removeInterceptor('navigateBack', backInterceptor);
});

// 监听 visible 变化重置选择器状态
watch(() => props.visible, (newVisible, oldVisible) => {
  if (!newVisible) {
    // 关闭主对话框时同步关闭菜品选择器
    showDishSelector.value = false;
    resetDishSelector();
  } else if (newVisible && !oldVisible && !props.plan) {
    // 打开新建对话框时重置表单
    resetForm();
  }
});

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

// 日期选择
const onStartDateChange = (e: any) => {
  formData.value.startDate = e.detail.value;
};

const onEndDateChange = (e: any) => {
  formData.value.endDate = e.detail.value;
};

// 打开菜品选择器
const openDishSelector = () => {
  showDishSelector.value = true;
  tempSelectedDishes.value = [...selectedDishes.value];
};

// 关闭菜品选择器
const closeDishSelector = () => {
  showDishSelector.value = false;
  resetDishSelector();
};

// 重置选择器状态
const resetDishSelector = () => {
  searchKeyword.value = '';
  selectedCanteen.value = null;
  selectedWindow.value = null;
  dishList.value = [];
  tempSelectedDishes.value = [];
};

// 选择食堂
const onCanteenChange = async (e: any) => {
  const index = e.detail.value;
  selectedCanteen.value = canteenList.value[index];
  selectedWindow.value = null;
  dishList.value = [];
  
  if (selectedCanteen.value) {
    try {
      await canteenStore.fetchWindowList(selectedCanteen.value.id);
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
  
  if (selectedWindow.value) {
    dishLoading.value = true;
    try {
      const response = await getWindowDishes(selectedWindow.value.id);
      if (response.code === 200 && response.data?.items) {
        dishList.value = response.data.items;
      }
    } catch (err) {
      console.error('加载菜品列表失败:', err);
      dishList.value = [];
    } finally {
      dishLoading.value = false;
    }
  }
};

// 判断菜品是否已选中
const isDishSelected = (dishId: string) => {
  return tempSelectedDishes.value.some(d => d.id === dishId);
};

// 切换菜品选择状态
const toggleDishSelection = (dish: Dish) => {
  const index = tempSelectedDishes.value.findIndex(d => d.id === dish.id);
  if (index >= 0) {
    tempSelectedDishes.value.splice(index, 1);
  } else {
    tempSelectedDishes.value.push(dish);
  }
};

// 确认菜品选择
const confirmDishSelection = () => {
  selectedDishes.value = [...tempSelectedDishes.value];
  formData.value.dishes = selectedDishes.value.map(d => d.id);
  closeDishSelector();
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
  // 1. 如果选择了窗口，使用本地过滤（通过 computed 属性 filteredDishList 自动实现）
  if (selectedWindow.value) {
    return;
  }

  // 2. 如果没有选择窗口，调用后端接口搜索
  if (!searchKeyword.value.trim()) {
    // 如果没有搜索词且没有选择窗口，清空列表
    dishList.value = [];
    return;
  }

  dishLoading.value = true;
  try {
    const params: any = {
      search: {
        keyword: searchKeyword.value
      },
      filter: {},
      isSuggestion: false, // 搜索时不使用推荐模式
      pagination: {
        page: 1,
        pageSize: 50 // 搜索结果显示前50条
      }
    };

    // 如果选择了食堂，添加食堂ID过滤
    if (selectedCanteen.value) {
      params.filter.canteenId = [selectedCanteen.value.id];
    }

    const response = await getDishes(params);
    if (response.code === 200 && response.data?.items) {
      dishList.value = response.data.items;
    } else {
      dishList.value = [];
    }
  } catch (err) {
    console.error('搜索菜品失败:', err);
    uni.showToast({
      title: '搜索失败，请重试',
      icon: 'none'
    });
    dishList.value = [];
  } finally {
    dishLoading.value = false;
  }
};

// 清除搜索关键词并立即刷新结果
const clearSearch = async () => {
  searchKeyword.value = '';
  // handleSearch 会根据 selectedWindow 的状态做适当的操作
  await handleSearch();
};

// 关闭对话框
const handleClose = () => {
  emit('close');
};

// 提交表单
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
  // Check that endDate is not before startDate
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