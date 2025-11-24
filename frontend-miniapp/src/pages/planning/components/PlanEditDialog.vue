<template>
  <view v-if="visible" class="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @tap="handleClose">
    <view class="bg-white rounded-2xl flex flex-col mx-5" style="width: calc(100vw - 40px); max-width: 90vw; max-height: 80vh;" @tap.stop>
      <view class="p-5 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
        <text class="text-xl font-bold">{{ isEdit ? '编辑规划' : '新建规划' }}</text>
        <view @tap="handleClose" class="w-6 h-6 flex items-center justify-center">
          <text class="text-2xl text-gray-600">×</text>
        </view>
      </view>

      <scroll-view scroll-y class="flex-1 px-5 py-5">
        <view class="mb-5">
          <text class="block mb-2 font-medium">开始日期</text>
          <picker mode="date" :value="formData.startDate" @change="onStartDateChange" class="block">
              <view class="w-full max-w-[320px] py-3 px-3 border border-gray-300 rounded-lg mx-auto">
              <text>{{ formData.startDate || '请选择日期' }}</text>
            </view>
          </picker>
        </view>

        <view class="mb-5">
          <text class="block mb-2 font-medium">结束日期</text>
          <picker mode="date" :value="formData.endDate" @change="onEndDateChange" class="block">
              <view class="w-full max-w-[320px] py-3 px-3 border border-gray-300 rounded-lg mx-auto">
              <text>{{ formData.endDate || '请选择日期' }}</text>
            </view>
          </picker>
        </view>

        <view class="mb-5">
          <text class="block mb-2 font-medium">用餐时间</text>
          <picker mode="selector" :range="mealTimeOptions" range-key="label" @change="onMealTimeChange" class="block">
              <view class="w-full max-w-[320px] py-3 px-3 border border-gray-300 rounded-lg mx-auto">
              <text>{{ currentMealTimeLabel || '请选择' }}</text>
            </view>
          </picker>
        </view>

        <view class="mb-5">
          <text class="block mb-2 font-medium">选择菜品</text>
          <view class="border border-gray-300 rounded-lg p-3">
            <view v-if="formData.dishes.length === 0" class="text-center py-5">
              <text class="text-gray-400 text-sm">请点击"添加菜品"按钮选择菜品</text>
            </view>
            <view v-else class="mb-3">
              <view 
                v-for="(dishId, index) in formData.dishes" 
                :key="dishId"
                class="bg-gray-100 py-1.5 px-3 rounded-full inline-flex items-center mr-2 mb-2"
              >
                <text class="text-sm mr-2">菜品 {{ index + 1 }}</text>
                <text @tap="removeDish(index)" class="text-lg text-gray-500">×</text>
              </view>
            </view>
            <view 
              @tap="showDishSelector = true"
              class="w-full max-w-[320px] py-2 border border-dashed border-purple-700 bg-purple-50 rounded-lg text-center mx-auto"
            >
              <text class="text-purple-700">+ 添加菜品</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="p-4 border-t border-gray-100 flex justify-end flex-shrink-0">
        <view @tap="handleClose" class="py-2 px-6 border border-gray-300 rounded-lg mr-3">
          <text class="text-gray-600">取消</text>
        </view>
        <view 
          @tap="handleSubmit" 
          class="py-2 px-6 rounded-lg"
          :class="submitting ? 'bg-purple-400' : 'bg-purple-700'"
        >
          <text class="text-gray-500 border-b border-gray-300 rounded-lg">{{ submitting ? '提交中...' : '确定' }}</text>
        </view>
      </view>
    </view>

    <!-- 菜品选择器 -->
    <view v-if="showDishSelector" class="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @tap="showDishSelector = false">
      <view class="bg-white rounded-2xl mx-5" style="width: calc(100vw - 40px); max-width: 400px;" @tap.stop>
        <view class="p-5">
          <view class="mb-4">
            <text class="text-lg font-bold">选择菜品</text>
          </view>
          <view class="mb-4">
            <text class="text-gray-500 text-sm block mb-2">请输入菜品ID（实际应该是菜品列表）</text>
            <input 
              v-model="tempDishId" 
              class="py-2 px-3 border border-gray-300 rounded-lg w-full"
              style="box-sizing: border-box;"
              placeholder="输入菜品ID"
            />
          </view>
          <view class="flex justify-end">
            <view @tap="showDishSelector = false" class="py-2 px-6 border border-gray-300 rounded-lg mr-3">
              <text class="text-gray-600">取消</text>
            </view>
            <view @tap="addDish" class="py-2 px-6 bg-purple-700 rounded-lg">
              <text class="text-white">添加</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { EnrichedMealPlan } from '../composables/use-menu-planning';
import type { MealPlanRequest } from '@/types/api';
import dayjs from 'dayjs';

const props = defineProps<{
  visible: boolean;
  plan: EnrichedMealPlan | null;
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: MealPlanRequest];
}>();

const isEdit = computed(() => !!props.plan);
const submitting = ref(false);
const showDishSelector = ref(false);
const tempDishId = ref('');

const mealTimeOptions = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '夜宵', value: 'nightsnack' },
];

const formData = ref<MealPlanRequest & { dishes: string[] }>({
  startDate: '',
  endDate: '',
  mealTime: undefined,
  dishes: [],
});

const currentMealTimeLabel = computed(() => {
  const found = mealTimeOptions.find(opt => opt.value === formData.value.mealTime);
  return found?.label || '';
});

watch(() => props.plan, (newPlan) => {
  if (newPlan) {
    formData.value = {
      startDate: dayjs(newPlan.startDate).format('YYYY-MM-DD'),
      endDate: dayjs(newPlan.endDate).format('YYYY-MM-DD'),
      mealTime: newPlan.mealTime,
      dishes: newPlan.dishes.map(d => d.id),
    };
  } else {
    formData.value = {
      startDate: dayjs().format('YYYY-MM-DD'),
      endDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      mealTime: undefined,
      dishes: [],
    };
  }
}, { immediate: true });

const onStartDateChange = (e: any) => {
  formData.value.startDate = e.detail.value;
};

const onEndDateChange = (e: any) => {
  formData.value.endDate = e.detail.value;
};

const onMealTimeChange = (e: any) => {
  formData.value.mealTime = mealTimeOptions[e.detail.value].value as any;
};

const handleClose = () => {
  emit('close');
};

const handleSubmit = async () => {
  if (!formData.value.mealTime || formData.value.dishes.length === 0) {
    uni.showToast({
      title: '请完整填写表单',
      icon: 'none',
    });
    return;
  }

  submitting.value = true;
  try {
    await emit('submit', formData.value);
  } finally {
    submitting.value = false;
  }
};

const addDish = () => {
  if (tempDishId.value && !formData.value.dishes?.includes(tempDishId.value)) {
    formData.value.dishes = [...(formData.value.dishes || []), tempDishId.value];
    tempDishId.value = '';
    showDishSelector.value = false;
  }
};

const removeDish = (index: number) => {
  formData.value.dishes = formData.value.dishes?.filter((_, i) => i !== index) || [];
};
</script>