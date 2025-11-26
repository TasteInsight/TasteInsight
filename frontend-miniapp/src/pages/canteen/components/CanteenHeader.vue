<template>
  <view v-if="canteen" class="px-4 py-4">
    <view class="text-xl font-bold text-gray-800">{{ canteen.name }}</view>
    <view v-if="canteen.description" class="text-sm text-gray-500 mt-2">
      {{ canteen.description }}
    </view>
    <view v-if="formattedHours" class="text-xs text-gray-400 mt-2">
      营业时间：{{ formattedHours }}
    </view>
  </view>
  <view v-else class="px-4 py-4 text-gray-500">食堂信息加载中...</view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Canteen } from '@/types/api';

const props = defineProps<{ canteen: Canteen | null }>();

const formattedHours = computed(() => {
  if (!props.canteen?.openingHours?.length) return '';
  // 简单展示当天的营业时间，这里取第一条作为示例
  const today = props.canteen.openingHours[0];
  if (today && !today.isClosed && today.slots) {
    return today.slots.map(s => `${s.openTime}-${s.closeTime}`).join(', ');
  }
  return '休息中';
});
</script>
