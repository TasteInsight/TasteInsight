<template>
  <view v-if="canteen" class="px-4 py-4">
    <view class="text-xl font-bold text-gray-800">{{ canteen.name }}</view>
    <view v-if="canteen.description" class="text-sm text-gray-500 mt-2">
      {{ canteen.description }}
    </view>
    <view v-if="canteen.operatingHours" class="text-xs text-gray-400 mt-2">
      营业时间：{{ canteen.operatingHours }}
    </view>
  </view>
  <view v-else class="px-4 py-4 text-gray-500">食堂信息加载中...</view>
</template>

<script setup lang="ts">
import type { Canteen } from '@/types/api';
const props = defineProps<{ canteen: Canteen | null }>();
</script>
