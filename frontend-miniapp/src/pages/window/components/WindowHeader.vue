<template>
  <view class="window-header" :aria-busy="loading">
    <view v-if="error" class="window-header-feedback" role="alert">
      <text>{{ error }}</text
      ><button class="window-header-action" :disabled="loading" @tap="emit('retry')">
        重新加载
      </button>
    </view>
    <template v-if="window">
      <view class="flex items-center justify-between">
        <view class="text-xl font-bold text-gray-800">{{ window.name }}</view>
      </view>

      <view v-if="window.description" class="text-sm text-gray-500 mt-2">
        {{ window.description }}
      </view>

      <view v-if="locationText" class="text-xs text-gray-500 mt-2"> 位置：{{ locationText }} </view>

      <view v-if="window.tags && window.tags.length > 0" class="flex flex-wrap mt-2 gap-1.5">
        <TagBadge v-for="(tag, index) in window.tags" :key="index" :label="tag" />
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Window } from '@/types/api';
import TagBadge from '@/components/TagBadge.vue';

const props = defineProps<{
  window: Window | null;
  loading?: boolean;
  error?: string;
}>();
const emit = defineEmits<{ retry: [] }>();

const locationText = computed(() => {
  if (!props.window) return '';
  const parts = [];
  if (props.window.floor?.name) parts.push(props.window.floor.name);
  else if (props.window.floor?.level) parts.push(props.window.floor.level + '层');
  if (props.window.position) parts.push(props.window.position);
  return parts.join(' - ');
});
</script>
<style scoped>
.window-header {
  padding: 16px;
  background: #fff;
}
.window-header-feedback {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  color: #667085;
  font-size: 14px;
}
.window-header-action {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  border: 0;
  background: #fff;
  color: #660874;
  font-size: 14px;
  line-height: 1.5;
}
.window-header-action::after {
  border: 0;
}
.window-header-action:focus-visible {
  outline: 2px solid #660874;
}
</style>
