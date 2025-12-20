<template>
  <view v-if="window" class="bg-white px-4 py-4">
    <view class="flex items-center justify-between">
      <view class="text-xl font-bold text-gray-800">{{ window.name }}</view>
    </view>
    
    <view v-if="window.description" class="text-sm text-gray-500 mt-2">
      {{ window.description }}
    </view>
    
    <view v-if="locationText" class="text-xs text-gray-400 mt-2">
      位置：{{ locationText }}
    </view>

    <view v-if="window.tags && window.tags.length > 0" class="flex flex-wrap mt-2 gap-1.5">
      <view
        v-for="(tag, index) in window.tags"
        :key="index"
        class="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded"
      >
        {{ tag }}
      </view>
    </view>
  </view>
  <view v-else class="px-4 py-4 text-gray-500">窗口信息加载中...</view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Window } from '@/types/api';

const props = defineProps<{
  window: Window | null;
}>();

const locationText = computed(() => {
  if (!props.window) return '';
  const parts = [];
  if (props.window.floor?.name) parts.push(props.window.floor.name);
  if (props.window.position) parts.push(props.window.position);
  return parts.join(' - ');
});
</script>
