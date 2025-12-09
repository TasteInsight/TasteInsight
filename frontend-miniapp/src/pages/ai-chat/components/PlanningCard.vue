<template>
  <view class="bg-white rounded-xl p-4 mb-3 shadow-sm">
    <view class="border-b border-gray-100 pb-2 mb-3">
      <text class="text-base font-semibold text-gray-800">饮食规划建议</text>
    </view>
    
    <view class="mb-4">
      <text class="text-sm text-gray-600 leading-relaxed block">{{ plan.summary }}</text>
      
      <view v-if="plan.previewData" class="mt-2 bg-gray-50 p-2 rounded-lg">
        <view v-for="(value, key) in plan.previewData" :key="key" class="text-xs mb-1 flex">
          <text class="text-gray-500 mr-1">{{ key }}: </text>
          <text class="text-gray-800">{{ value }}</text>
        </view>
      </view>
    </view>

    <view class="flex gap-3">
      <button class="flex-1 text-sm py-2 rounded-full bg-gray-100 text-gray-600 border-none after:border-none" @click="handleDiscard">放弃</button>
      <button class="flex-1 text-sm py-2 rounded-full bg-ts-purple text-white border-none after:border-none" @click="handleApply">应用规划</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { ComponentMealPlanDraft } from '@/types/api';

const props = defineProps<{
  plan: ComponentMealPlanDraft;
}>();

const emit = defineEmits<{
  (e: 'apply', plan: ComponentMealPlanDraft): void;
  (e: 'discard'): void;
}>();

const handleApply = () => {
  emit('apply', props.plan);
};

const handleDiscard = () => {
  emit('discard');
};
</script>
