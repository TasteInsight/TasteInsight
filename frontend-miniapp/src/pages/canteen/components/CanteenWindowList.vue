<template>
  <view v-if="windows.length" class="canteen-windows">
    <text class="canteen-windows-title">按窗口浏览</text>
    <scroll-view
      scroll-x
      :show-scrollbar="false"
      class="canteen-windows-scroll"
      aria-label="食堂窗口"
    >
      <view class="canteen-windows-row">
        <button
          v-for="window in windows"
          :key="window.id"
          class="canteen-window"
          :aria-label="`浏览${window.name}`"
          :title="window.name"
          @tap="emit('click', window.id)"
        >
          <text class="canteen-window-name">{{ window.name }}</text>
          <text v-if="window.floor?.name || window.floor?.level" class="canteen-window-floor">{{
            window.floor.name || window.floor.level + '层'
          }}</text>
        </button>
      </view>
    </scroll-view>
  </view>
</template>
<script setup lang="ts">
import type { Window } from '@/types/api';
defineProps<{ windows: Window[] }>();
const emit = defineEmits<{ (e: 'click', id: string): void }>();
</script>
<style scoped>
.canteen-windows {
  padding: 0 16px 20px;
}
.canteen-windows-title {
  display: block;
  margin-bottom: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}
.canteen-windows-scroll {
  width: 100%;
  white-space: nowrap;
}
.canteen-windows-row {
  display: inline-flex;
  align-items: stretch;
  gap: 8px;
  min-width: 100%;
}
.canteen-window {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 104px;
  max-width: 160px;
  min-height: 52px;
  margin: 0;
  padding: 7px 12px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
  white-space: normal;
}
.canteen-window::after {
  border: 0;
}
.canteen-window:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.canteen-window:active {
  background: #f4f4f5;
}
.canteen-window-name,
.canteen-window-floor {
  display: block;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.canteen-window-name {
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}
.canteen-window-floor {
  margin-top: 2px;
  font-size: 12px;
  color: #667085;
  line-height: 1.5;
}
</style>
