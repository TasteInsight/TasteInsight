<template>
  <view class="window-header" :aria-busy="loading">
    <AsyncState
      :loading="loading"
      :has-content="!!window"
      :error="error"
      :loading-title="t('food.loadingCounter')"
      @retry="emit('retry')"
    />
    <template v-if="window">
      <view class="flex items-center justify-between">
        <view class="text-xl font-bold text-gray-800">{{ window.name }}</view>
      </view>

      <view v-if="window.description" class="text-sm text-gray-500 mt-2">
        {{ window.description }}
      </view>

      <view v-if="locationText" class="text-xs text-gray-500 mt-2">
        {{ t('food.locationLabel', { location: locationText }) }}
      </view>

      <view v-if="window.tags && window.tags.length > 0" class="flex flex-wrap mt-2 gap-1.5">
        <TagBadge v-for="(tag, index) in window.tags" :key="index" :label="tag" />
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import AsyncState from '@/components/AsyncState.vue';
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
  else if (props.window.floor?.level)
    parts.push(t('food.floorLevel', { floor: props.window.floor.level }));
  if (props.window.position) parts.push(props.window.position);
  return parts.join(' - ');
});
</script>
<style scoped>
.window-header {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #fff;
}
</style>
