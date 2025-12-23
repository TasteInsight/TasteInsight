<template>
  <view class="bg-white rounded-xl p-3 mb-3 shadow-sm cursor-pointer" @click="goToDishDetail">
    <view class="flex">
      <image :src="dish.dish.image || '/default-dish.png'" class="w-20 h-20 rounded-lg flex-shrink-0 object-cover" mode="aspectFill" />
      <view class="flex-grow ml-3 flex flex-col justify-between">
        <view>
            <view class="font-medium text-base text-gray-800 line-clamp-1">{{ dish.dish.name }}</view>
            <view class="text-xs text-gray-500 mt-1">{{ dish.canteenName }} {{ dish.windowName }}</view>
        </view>
        
        <view class="flex items-center justify-between mt-1">
            <view class="flex items-center">
                <text class="text-yellow-500 text-sm">★</text>
            <text class="text-yellow-600 text-sm ml-0.5">{{ formattedRating }}</text>
            </view>
        </view>

        <view v-if="dish.recommendReason" class="mt-1.5 text-xs">
          <text class="text-gray-500">推荐理由: </text>
          <text class="text-ts-purple">{{ dish.recommendReason }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentDishCard } from '@/types/api';

const props = defineProps<{
  dish: ComponentDishCard;
}>();

const formattedRating = computed(() => {
  const raw = (props.dish as any)?.dish?.rating;
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n.toFixed(1) : '暂无';
});

const goToDishDetail = () => {
  if (props.dish.dish.id) {
    uni.navigateTo({
      url: `/pages/dish/index?id=${props.dish.dish.id}`,
    });
  }
};
</script>
