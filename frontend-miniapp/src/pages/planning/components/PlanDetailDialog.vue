<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-container 
    :show="visible" 
    :overlay="false" 
    :duration="300"
    custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
    @leave="handleClose" 
  />
  <!-- #endif -->

  <view 
    v-if="visible" 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" 
    @tap="handleClose"
    @touchmove.stop.prevent
  >
    <view 
      class="bg-white rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden" 
      style="max-height: 80vh;"
      @tap.stop
      @touchmove.stop
    >
      <view class="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
        <text class="text-xl font-bold">规划详情</text>
        <view @tap="handleClose" class="w-6 h-6 flex items-center justify-center">
          <text class="text-2xl text-gray-600">×</text>
        </view>
      </view>

      <scroll-view v-if="plan" scroll-y class="flex-1" style="max-height: calc(80vh - 140px);">
        <view class="p-5">
          <view class="bg-gray-50 p-4 rounded-lg mb-5">
            <view class="flex mb-3 items-center">
              <text class="text-gray-600 font-medium w-24 shrink-0">日期：</text>
              <text class="text-gray-900 break-words flex-1">{{ formatDate(plan.startDate) }}</text>
            </view>
            <view class="flex mb-3 items-center">
              <text class="text-gray-600 font-medium w-24 shrink-0">用餐时间：</text>
              <text class="text-gray-900 break-words flex-1">{{ mealTimeText }}</text>
            </view>
            <view class="flex items-center">
              <text class="text-gray-600 font-medium w-24 shrink-0">总价：</text>
              <text class="text-orange-500 font-bold text-lg break-words flex-1">¥{{ totalPrice.toFixed(2) }}</text>
            </view>
          </view>

          <view class="mt-5">
            <text class="text-lg font-semibold mb-4 block">包含菜品</text>
            <view 
              v-for="dish in plan.dishes" 
              :key="dish.id" 
              class="flex gap-3 p-3 border border-gray-100 rounded-lg mb-3 active:bg-gray-50"
              @tap="goToDishDetail(dish.id)"
            >
              <image 
                :src="dish.images[0] || '/default-dish.png'" 
                class="w-20 h-20 rounded-lg shrink-0" 
                mode="aspectFill"
              />
              <view class="flex-1 min-w-0">
                <text class="font-semibold block mb-1 break-words truncate">{{ dish.name }}</text>
                <text class="text-sm text-gray-600 block mb-2 break-words truncate">{{ dish.canteenName }} - {{ dish.windowName }}</text>
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

const goToDishDetail = (dishId: string) => {
  uni.navigateTo({
    url: `/pages/dish/index?id=${dishId}`
  });
};

const handleClose = () => {
  emit('close');
};
</script>