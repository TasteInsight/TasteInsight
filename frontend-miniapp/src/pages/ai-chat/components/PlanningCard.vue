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
      <button 
        class="flex-1 text-sm py-2 rounded-full border-none after:border-none" 
        :class="appliedButtonClass"
        :disabled="plan.appliedStatus === 'success'"
        @click="handleApply"
      >
        {{ appliedButtonText }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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

const handleApply = () => {
  emit('apply', props.plan);
};

const handleDiscard = () => {
  emit('discard');
};
</script>
