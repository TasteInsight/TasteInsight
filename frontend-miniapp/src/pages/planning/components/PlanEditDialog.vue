<template>
  <!-- 主对话框 - 从底部弹出 -->
  <view v-if="visible" class="fixed inset-0 bg-black/50 z-[1000] flex items-end px-3" @tap="handleClose">
    <view class="w-full max-h-[72vh] bg-white rounded-t-3xl flex flex-col overflow-hidden px-3 box-border" @tap.stop>
      <!-- 头部 -->
      <view class="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <text class="text-lg font-semibold text-gray-800">{{ isEdit ? '编辑规划' : '新建规划' }}</text>
        <view class="w-6 h-6 flex items-center justify-center text-gray-400 text-xl" @tap="handleClose">
          <text>✕</text>
        </view>
      </view>

      <!-- 表单内容 -->
      <view scroll-y class="flex-1 px-3 py-2 overflow-x-hidden">
        <!-- 日期选择行 -->
        <view class="mb-4">
          <view class="flex gap-3">
            <view class="flex-1">
              <text class="block text-sm text-gray-500 mb-2">开始日期</text>
              <picker mode="date" :value="formData.startDate" @change="onStartDateChange">
                <view class="flex items-center justify-between py-2.5 px-3 bg-gray-100 rounded-xl">
                  <text class="text-sm text-gray-700">{{ formData.startDate || '请选择' }}</text>
                  <text class="text-gray-400">›</text>
                </view>
              </picker>
            </view>
            <view class="flex-1">
              <text class="block text-sm text-gray-500 mb-2">结束日期</text>
              <picker mode="date" :value="formData.endDate" @change="onEndDateChange">
                <view class="flex items-center justify-between py-2.5 px-3 bg-gray-100 rounded-xl">
                  <text class="text-sm text-gray-700">{{ formData.endDate || '请选择' }}</text>
                  <text class="text-gray-400">›</text>
                </view>
              </picker>
            </view>
          </view>
        </view>

        <!-- 用餐时间 -->
        <view class="mb-4">
          <text class="block text-sm text-gray-500 mb-2">用餐时间</text>
          <view class="grid grid-cols-4 gap-3 max-w-[420px] w-full mx-auto">
            <view 
              v-for="option in mealTimeOptions" 
              :key="option.value"
              class="w-full py-2.5 text-center rounded-lg text-sm transition-all"
              :class="formData.mealTime === option.value 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-gray-100 text-gray-600'"
              @tap="selectMealTime(option.value)"
            >
              <text>{{ option.label }}</text>
            </view>
          </view>
        </view>

        <!-- 已选菜品 -->
        <view class="mb-4">
          <view class="flex items-center justify-between mb-2">
            <text class="text-sm text-gray-500">已选菜品</text>
            <text class="text-xs text-purple-600">{{ selectedDishes.length }} 个</text>
          </view>
          
          <view v-if="selectedDishes.length === 0" class="py-6 text-center bg-gray-50 rounded-xl">
            <text class="text-sm text-gray-400">暂未选择菜品</text>
          </view>
          
          <view v-else class="flex flex-wrap gap-2 mb-2.5">
            <view 
              v-for="dish in selectedDishes" 
              :key="dish.id"
              class="flex items-center py-1.5 px-2.5 bg-purple-50 rounded-full"
            >
              <text class="text-xs text-purple-600">{{ dish.name }}</text>
              <text class="ml-1.5 text-base text-purple-400" @tap="removeDish(dish.id)">×</text>
            </view>
          </view>
          
          <view class="flex justify-center">
            <view 
              class="py-3 text-center bg-purple-100 rounded-lg max-w-[420px] w-full"
              @tap="openDishSelector"
            >
              <text class="text-sm text-purple-700 font-medium">+ 添加菜品</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部按钮 -->
      <view class="flex gap-3 px-3 py-2 border-t border-gray-100 pb-safe">
        <view class="flex-1 py-2 text-center bg-gray-100 rounded-xl" @tap="handleClose">
          <text class="text-gray-500">取消</text>
        </view>
        <view 
          class="flex-1 py-2 text-center rounded-xl"
          :class="submitting ? 'bg-purple-300' : 'bg-ts-purple'"
          @tap="handleSubmit"
        >
          <text class="text-white">{{ submitting ? '提交中...' : '确定' }}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 菜品选择器 - 底部弹出 70% 高度 -->
  <view v-if="showDishSelector" class="fixed inset-0 bg-black/50 z-[1001] flex items-end px-3" @tap="closeDishSelector">
    <view class="w-full h-[65vh] bg-white rounded-t-3xl flex flex-col overflow-hidden px-3 box-border" @tap.stop>
      <!-- 头部 -->
      <view class="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
        <view class="w-8 h-8 flex items-center justify-center" @tap="closeDishSelector">
          <text class="text-xl text-gray-400">✕</text>
        </view>
        <text class="text-base font-semibold text-gray-800">选择菜品</text>
        <view 
          class="px-3 py-1.5 rounded-full"
          :class="tempSelectedDishes.length > 0 ? 'bg-purple-100' : 'bg-transparent'"
          @tap="confirmDishSelection"
        >
          <text 
            class="text-sm font-medium"
            :class="tempSelectedDishes.length > 0 ? 'text-purple-700' : 'text-gray-400'"
          >
            完成{{ tempSelectedDishes.length > 0 ? `(${tempSelectedDishes.length})` : '' }}
          </text>
        </view>
      </view>

      <!-- 筛选区域 -->
      <view class="px-4 py-3 bg-white border-b border-gray-100">
        <!-- 搜索框 -->
        <view class="flex items-center py-2 px-3 bg-gray-50 rounded-xl mb-2.5">
          <text class="text-base mr-2 text-gray-400">🔍</text>
          <input 
            v-model="searchKeyword" 
            class="flex-1 text-sm bg-transparent"
            placeholder="搜索菜品名称"
            placeholder-class="text-gray-400"
          />
        </view>
        
        <!-- 食堂和窗口选择 -->
        <view class="flex gap-2">
          <picker class="flex-1" mode="selector" :range="canteenList" range-key="name" @change="onCanteenChange">
            <view class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
              <text class="text-sm text-gray-700 truncate flex-1">{{ selectedCanteen?.name || '选择食堂' }}</text>
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
            <view class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
              <text class="text-sm text-gray-700 truncate flex-1">{{ selectedWindow?.name || '选择窗口' }}</text>
              <text class="text-xs text-gray-400 ml-2">▼</text>
            </view>
          </picker>
        </view>
      </view>

      <!-- 菜品列表 -->
      <scroll-view scroll-y class="flex-1 bg-gray-50 overflow-x-hidden">
        <view class="p-3 box-border">
          <!-- 加载状态 -->
          <view v-if="dishLoading" class="flex flex-col items-center justify-center py-16 text-gray-400">
            <text class="text-3xl mb-2">⏳</text>
            <text class="text-sm">加载中...</text>
          </view>
          
          <!-- 空状态 - 未选择窗口 -->
          <view v-else-if="!selectedWindow" class="flex flex-col items-center justify-center py-16 text-gray-400">
            <text class="text-4xl mb-2">🏪</text>
            <text class="text-sm">请先选择食堂和窗口</text>
          </view>
          
          <!-- 空状态 - 无菜品 -->
          <view v-else-if="filteredDishList.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
            <text class="text-4xl mb-2">🍽️</text>
            <text class="text-sm">{{ searchKeyword ? '未找到相关菜品' : '该窗口暂无菜品' }}</text>
          </view>
          
          <!-- 菜品列表 -->
          <view v-else class="flex flex-col gap-2">
            <view 
              v-for="dish in filteredDishList" 
              :key="dish.id"
              class="w-full flex items-center p-3 bg-white rounded-2xl shadow-sm transition-all box-border"
              :class="isDishSelected(dish.id) ? 'ring-2 ring-purple-500' : ''"
              @tap="toggleDishSelection(dish)"
            >
              <!-- 菜品图片 -->
              <image 
                v-if="dish.images && dish.images.length > 0"
                :src="dish.images[0]" 
                class="w-16 h-16 rounded-xl mr-3 flex-shrink-0"
                mode="aspectFill"
              />
              <view v-else class="w-16 h-16 rounded-xl mr-3 flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                <text class="text-2xl">🍜</text>
              </view>
              
              <!-- 菜品信息 -->
              <view class="flex-1 min-w-0 mr-2">
                <text class="text-sm font-medium text-gray-800 block truncate mb-1">{{ dish.name }}</text>
                <text class="text-sm text-amber-600 font-semibold">¥{{ dish.price }}</text>
              </view>
              
              <!-- 选择状态 -->
              <view 
                class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                :class="isDishSelected(dish.id) 
                  ? 'bg-purple-600 shadow-lg shadow-purple-300' 
                  : 'border-2 border-gray-300 bg-white'"
              >
                <text v-if="isDishSelected(dish.id)" class="text-white text-sm">✓</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { getWindowDishes } from '@/api/modules/canteen';
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
  if (!searchKeyword.value.trim()) {
    return dishList.value;
  }
  const keyword = searchKeyword.value.toLowerCase();
  return dishList.value.filter(dish => 
    dish.name.toLowerCase().includes(keyword)
  );
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
</style>