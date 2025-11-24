
<template>
  <view v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" @tap="handleClose">
    <view class="bg-white rounded-2xl w-full max-w-2xl max-h-screen-80 flex flex-col" @tap.stop>
      <view class="p-5 border-b border-gray-100 flex justify-between items-center">
        <text class="text-xl font-bold">规划详情</text>
        <view @tap="handleClose" class="w-6 h-6 flex items-center justify-center">
          <text class="text-2xl text-gray-600">×</text>
        </view>
      </view>

      <scroll-view v-if="plan" scroll-y class="flex-1 p-5">
        <view class="bg-gray-50 p-4 rounded-lg mb-5">
          <view class="flex mb-3">
            <text class="text-gray-600 font-medium w-24">日期：</text>
            <text class="text-gray-900">{{ formatDate(plan.startDate) }}</text>
          </view>
          <view class="flex mb-3">
            <text class="text-gray-600 font-medium w-24">用餐时间：</text>
            <text class="text-gray-900">{{ mealTimeText }}</text>
          </view>
          <view class="flex">
            <text class="text-gray-600 font-medium w-24">总价：</text>
            <text class="text-orange-500 font-bold text-lg">¥{{ totalPrice.toFixed(2) }}</text>
          </view>
        </view>

        <view class="mt-5">
          <text class="text-lg font-semibold mb-4 block">包含菜品</text>
          <view v-for="dish in plan.dishes" :key="dish.id" class="flex gap-3 p-3 border border-gray-100 rounded-lg mb-3">
            <image 
              :src="dish.images[0] || '/default-dish.png'" 
              class="w-20 h-20 rounded-lg" 
              mode="aspectFill"
            />
            <view class="flex-1">
              <text class="font-semibold block mb-1">{{ dish.name }}</text>
              <text class="text-sm text-gray-600 block mb-2">{{ dish.canteenName }} - {{ dish.windowName }}</text>
              <view class="flex justify-between items-center">
                <text class="text-orange-500 font-bold">¥{{ dish.price }}</text>
                <view class="flex items-center gap-1">
                  <text class="text-yellow-500">★</text>
                  <text class="text-yellow-500">{{ dish.averageRating.toFixed(1) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="p-4 border-t border-gray-100 flex justify-end">
        <view @tap="handleClose" class="py-2 px-6 border border-gray-300 rounded-lg bg-white">
          <text class="text-gray-600">关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EnrichedMealPlan } from '../composables/use-menu-planning';
import dayjs from 'dayjs';

const props = defineProps<{
  visible: boolean;
  plan: EnrichedMealPlan | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const mealTimeMap = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  nightsnack: '夜宵'
};

const mealTimeText = computed(() => 
  props.plan ? mealTimeMap[props.plan.mealTime] || '用餐' : ''
);

const totalPrice = computed(() => 
  props.plan?.dishes.reduce((sum, dish) => sum + dish.price, 0) || 0
);

const formatDate = (date: string) => dayjs(date).format('YYYY年MM月DD日');

const handleClose = () => {
  emit('close');
};
</script>