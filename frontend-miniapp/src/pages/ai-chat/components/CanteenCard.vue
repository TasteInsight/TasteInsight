<template>
  <view class="bg-white rounded-xl p-3 mb-3 shadow-sm cursor-pointer" @click="goToCanteen">
    <view class="flex items-center">
      <image :src="canteen.image || '/default-canteen.png'" class="w-16 h-16 rounded-lg flex-shrink-0 object-cover" mode="aspectFill" />
      <view class="flex-grow ml-3">
        <view class="font-medium text-base text-gray-800">{{ canteen.name }}</view>
        <view class="flex items-center mt-1">
          <text class="text-xs" :class="statusClass">{{ displayStatus }}</text>
          <view class="flex items-center ml-2">
             <text class="text-yellow-500 text-xs">★</text>
             <text class="text-yellow-600 text-xs ml-0.5">{{ !canteen.averageRating || canteen.averageRating === 0 ? '暂无评分' : canteen.averageRating.toFixed(1) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentCanteenCard } from '@/types/api';

const props = defineProps<{
  canteen: ComponentCanteenCard;
}>();

const displayStatus = computed(() => {
  const status = props.canteen.status;
  
  switch (status) {
    case 'open':
      return '营业中';
    case 'closed':
      return '已打烊';
    case 'unknown':
      return '暂无营业信息';
    default:
      return status || '营业中';
  }
});

const statusClass = computed(() => {
  const status = props.canteen.status;
  
  switch (status) {
    case 'open':
      return 'text-green-600';
    case 'closed':
      return 'text-gray-500';
    case 'unknown':
      return 'text-gray-400';
    default:
      return 'text-gray-500';
  }
});

const goToCanteen = () => {
  if (props.canteen.id) {
    uni.navigateTo({
      url: `/pages/canteen/index?id=${props.canteen.id}`,
    });
  }
};
</script>
