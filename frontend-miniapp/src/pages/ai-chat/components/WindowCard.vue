<template>
  <view class="bg-white rounded-xl p-3 mb-3 shadow-sm cursor-pointer" @click="goToWindow">
    <view class="flex items-center">
      <image :src="window.image || '/default-window.png'" class="w-16 h-16 rounded-lg flex-shrink-0 object-cover" mode="aspectFill" />
      <view class="flex-grow ml-3">
        <view class="font-medium text-base text-gray-800">{{ window.name }}</view>
        <view class="text-xs text-gray-500 mt-0.5">{{ window.canteenName }}</view>
        <view class="flex items-center mt-1">
          <text class="text-xs text-gray-500">{{ window.status || '营业中' }}</text>
          <view v-if="window.rating" class="flex items-center ml-2">
             <text class="text-yellow-500 text-xs">★</text>
             <text class="text-yellow-600 text-xs ml-0.5">{{ window.rating.toFixed(1) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { ComponentWindowCard } from '@/types/api';

const props = defineProps<{
  window: ComponentWindowCard;
}>();

const goToWindow = () => {
  if (props.window.id) {
    uni.navigateTo({
      url: `/pages/window/index?id=${props.window.id}`,
    });
  }
};
</script>
