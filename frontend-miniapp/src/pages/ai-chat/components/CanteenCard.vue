<template>
  <view class="bg-white rounded-xl p-3 mb-3 shadow-sm cursor-pointer" @click="goToCanteen">
    <view class="flex items-center">
      <image :src="canteen.image || '/default-canteen.png'" class="w-16 h-16 rounded-lg flex-shrink-0 object-cover" mode="aspectFill" />
      <view class="flex-grow ml-3">
        <view class="font-medium text-base text-gray-800">{{ canteen.name }}</view>
        <view class="flex items-center mt-1">
          <text class="text-xs text-gray-500">{{ canteen.status || '营业中' }}</text>
          <view v-if="canteen.averageRating" class="flex items-center ml-2">
             <text class="text-yellow-500 text-xs">★</text>
             <text class="text-yellow-600 text-xs ml-0.5">{{ canteen.averageRating.toFixed(1) }}</text>
          </view>
        </view>
      </view>
      <view class="text-ts-purple text-sm">详情 ></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { ComponentCanteenCard } from '@/types/api';

const props = defineProps<{
  canteen: ComponentCanteenCard;
}>();

const goToCanteen = () => {
  if (props.canteen.id) {
    uni.navigateTo({
      url: `/pages/canteen/index?id=${props.canteen.id}`,
    });
  }
};
</script>
