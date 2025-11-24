<template>
  <view v-if="window" class="px-4 py-4">
    <view class="flex items-start">
      <text class="text-xl font-semibold text-gray-800">{{ window.name }}</text>
      <text v-if="window.number" class="ml-2 text-sm text-gray-500">#{{ window.number }}</text>
    </view>

    <view class="mt-2 flex items-center space-x-3">
      <text v-if="window.position" class="text-sm text-gray-500">位置：{{ window.position }}</text>
    </view>

    <text v-if="window.description" class="text-sm text-gray-500 mt-2 block">
      {{ window.description }}
    </text>

    <view v-if="window.tag && window.tag.length" class="mt-3 flex flex-wrap gap-2">
      <text class="text-sm text-gray-500 w-full">特色：</text>
      <view v-for="(t, idx) in window.tag" :key="idx" class="px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
        {{ t }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Window } from '@/types/api';

defineProps<{
  window: Window | null;
}>();
</script>
