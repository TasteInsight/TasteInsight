<template>
  <div 
    class="bg-white rounded-lg p-4 mb-2 shadow-sm"
    @click="handleClick"
  >
    <div class="flex items-center gap-3">
      <div class="w-14 h-14 rounded-lg bg-orange-50 flex items-center justify-center">
        <text class="iconify text-orange-500 text-2xl" data-icon="mdi:window-open-variant"></text>
      </div>
      <div class="flex-1">
        <div class="font-semibold text-gray-800">{{ window.name }}</div>
        <div class="text-xs text-gray-500 mt-1">
          {{ canteenName }} · {{ window.floor?.name || `${window.floor?.level}楼` }}
        </div>
        <div v-if="window.tags?.length" class="flex flex-wrap gap-1 mt-2">
          <span 
            v-for="tag in window.tags.slice(0, 3)" 
            :key="tag"
            class="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded"
          >
            {{ tag }}
          </span>
        </div>
      </div>
      <text class="iconify text-gray-400" data-icon="mdi:chevron-right"></text>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Window } from '@/types/api';

interface ExtendedWindow extends Window {
  canteenId?: string;
  canteenName?: string;
}

interface Props {
  window: ExtendedWindow;
  canteenName?: string;
}

const props = defineProps<Props>();

const handleClick = () => {
  const windowData = props.window as ExtendedWindow;
  const canteenId = windowData.canteenId || '';
  
  uni.navigateTo({
    url: `/pages/window/index?id=${props.window.id}&canteenId=${canteenId}`,
  });
};
</script>
