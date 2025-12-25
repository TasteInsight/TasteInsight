<template>
  <view class="bg-white rounded-xl shadow-sm p-4 mb-3 w-full box-border">
    <view class="bg-ts-purple py-2 px-3 rounded-lg mb-3 flex justify-between items-center">
      <text class="font-bold text-white">{{ headerText }}</text>
    </view>

    <view v-if="plan.summary" class="mb-3">
      <text class="text-sm text-gray-600 leading-relaxed block">{{ plan.summary }}</text>
    </view>

    <view v-if="preview?.dishes?.length">
      <view v-for="dish in preview.dishes" :key="dish.id" class="flex mb-3">
        <image
          :src="dish.images?.[0] || '/static/default_dish.png'"
          class="w-20 h-20 rounded-lg"
          mode="aspectFill"
        />
        <view class="ml-3 flex-1">
          <text class="font-medium text-base block">{{ dish.name }}</text>
          <text class="text-sm text-gray-500 mt-1 block">{{ dish.canteenName }}</text>
          <view class="flex justify-between items-center mt-2">
            <text class="text-orange-500 font-bold">¥{{ Number(dish.price || 0).toFixed(1) }}</text>
            <view class="flex items-center" v-if="typeof dish.averageRating === 'number'">
              <text class="text-yellow-500">★</text>
              <text class="text-yellow-500 ml-1">{{ dish.averageRating === 0 ? '暂无' : dish.averageRating.toFixed(1) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
      <text class="text-gray-600">总价：¥{{ totalPrice.toFixed(1) }}</text>
      <view class="flex gap-2">
        <button
          class="text-sm py-2 px-4 rounded-full bg-gray-100 text-gray-600 border-none after:border-none"
          @click="handleDiscard"
        >
          放弃
        </button>
        <button
          class="text-sm py-2 px-4 rounded-full border-none after:border-none"
          :class="appliedButtonClass"
          :disabled="plan.appliedStatus === 'success'"
          @click="handleApply"
        >
          {{ appliedButtonText }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import type { ComponentMealPlanDraft } from '@/types/api';

const props = defineProps<{
  plan: ComponentMealPlanDraft & { appliedStatus?: 'success' | 'failed' };
}>();

const emit = defineEmits<{
  (e: 'apply', plan: ComponentMealPlanDraft): void;
  (e: 'discard'): void;
}>();

const appliedButtonText = computed(() => {
  if (props.plan.appliedStatus === 'success') return '已应用';
  if (props.plan.appliedStatus === 'failed') return '应用失败，重试';
  return '应用规划';
});

const appliedButtonClass = computed(() => {
  if (props.plan.appliedStatus === 'success') return 'bg-green-500 text-white';
  if (props.plan.appliedStatus === 'failed') return 'bg-red-500 text-white';
  return 'bg-ts-purple text-white';
});

const preview = computed(() => props.plan.previewData);

const mealTimeMap: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  nightsnack: '夜宵',
};

const headerText = computed(() => {
  const p = preview.value;
  if (!p?.startDate) return '饮食规划建议';
  const dateText = dayjs(p.startDate).format('MM月DD日');
  const mealText = mealTimeMap[p.mealTime] || '用餐';
  return `${dateText} | ${mealText}`;
});

const totalPrice = computed(() => {
  const list = preview.value?.dishes || [];
  return list.reduce((sum, dish) => sum + Number((dish as any).price || 0), 0);
});

const handleApply = () => {
  emit('apply', props.plan);
};

const handleDiscard = () => {
  emit('discard');
};
</script>
