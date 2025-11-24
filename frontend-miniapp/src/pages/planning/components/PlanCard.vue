<template>
  <view @tap="$emit('view')" class="bg-white rounded-xl shadow-sm p-4 mb-3 cursor-pointer">
    <view class="bg-purple-700 py-2 px-3 rounded-lg mb-3 flex justify-between items-center">
      <text class="font-bold text-gray-400">{{ formatDate(plan.startDate) }} | {{ mealTimeText }}</text>
      <view class="flex gap-2">
        <text @tap.stop="$emit('view')" class="text-gray-400 text-sm">查看</text>
        <text v-if="!isHistory" @tap.stop="$emit('edit')" class="text-gray-400 text-sm">编辑</text>
        <text @tap.stop="$emit('delete')" class="text-gray-400 text-sm">删除</text>
      </view>
    </view>

    <view v-for="dish in plan.dishes" :key="dish.id" class="flex mb-3">
      <image 
        :src="dish.images[0] || '/default-dish.png'" 
        class="w-20 h-20 rounded-lg" 
        mode="aspectFill"
      />
      <view class="ml-3 flex-1">
        <text class="font-medium text-base block">{{ dish.name }}</text>
        <text class="text-sm text-gray-500 mt-1 block">{{ dish.canteenName }}</text>
        <view class="flex justify-between items-center mt-2">
          <text class="text-orange-500 font-bold">¥{{ dish.price }}</text>
          <view class="flex items-center">
            <text class="text-yellow-500">★</text>
            <text class="text-yellow-500 ml-1">{{ dish.averageRating.toFixed(1) }}</text>
          </view>
        </view>
      </view>
    </view>
    
    <view class="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
      <text class="text-gray-600">总价：¥{{ totalPrice.toFixed(1) }}</text>
      <view 
        v-if="!isHistory" 
        @tap.stop="$emit('execute')"
        class="bg-purple-700 text-gray-400 py-2 px-6 rounded-full"
      >
        <text class="text-gray-500">执行</text>
      </view>
      <text v-else class="text-gray-500 text-sm">已完成</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import dayjs from 'dayjs';

const props = defineProps<{
  plan: EnrichedMealPlan;
  isHistory?: boolean;
}>();

const emit = defineEmits<{
  (e: 'view'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'execute'): void;
}>();

const mealTimeMap = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  nightsnack: '夜宵'
};

const mealTimeText = computed(() => mealTimeMap[props.plan.mealTime] || '用餐');

const totalPrice = computed(() => 
  props.plan.dishes.reduce((sum, dish) => sum + dish.price, 0)
);

const formatDate = (date: string) => dayjs(date).format('MM月DD日');
</script>

