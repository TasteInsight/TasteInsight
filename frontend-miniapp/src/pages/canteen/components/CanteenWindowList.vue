<template>
  <view v-if="windows.length > 0" class="px-4 py-4">
    <view class="text-base font-semibold text-gray-800 mb-3">窗口列表</view>
    <view class="flex overflow-x-auto pb-2 hide-scrollbar">
      <view
        v-for="window in windows"
        :key="window.id"
        class="w-20 h-20 flex flex-col items-center justify-center rounded-lg mr-3 bg-white shadow-sm cursor-pointer flex-shrink-0 hover:shadow-md transition-shadow"
        @tap="() => handleClick(window.id)"
      >
        <span class="text-xs font-medium text-gray-700 text-center">{{ window.name }}</span>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Window } from '@/types/api';

const props = defineProps<{ windows: Window[] }>();
const emit = defineEmits<{ (e: 'click', id: string): void }>();

const handleClick = (id: string) => {
  emit('click', id);
};
</script>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
