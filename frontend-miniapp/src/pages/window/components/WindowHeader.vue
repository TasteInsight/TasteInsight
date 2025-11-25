<template>
  <view v-if="window" class="px-4 py-4">
    <text class="text-xl font-semibold text-gray-800">{{ window.name }}</text>
    <text v-if="window.description" class="text-sm text-gray-500 mt-1 block">
      {{ window.description }}
    </text>
  </view>
</template>

<script setup lang="ts">
import type { Window } from '@/types/api';

defineProps<{
  window: Window | null;
}>();
</script>
