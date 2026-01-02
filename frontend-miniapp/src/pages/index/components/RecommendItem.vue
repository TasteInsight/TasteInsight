<!-- @/components/RecommendItem.vue -->
<template>
  <view 
    class="flex py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" 
    :data-allergen="dish.allergens?.join(',') || '无'"
    @click="goToDetail"
  >
    <img :src="dish.images[0] || '/static/default_dish.png'" :alt="dish.name" class="w-20 h-20 rounded-lg mr-4" style="object-fit:cover" />
    <view class="flex-grow flex flex-col justify-between">
      <view>
        <h3 class="font-semibold text-base text-gray-800">{{ dish.name }}</h3>
        <p class="text-xs text-gray-500 mt-1">{{ dish.canteenName }} · {{ dish.windowName }}</p>
        <!-- Tags -->
        <view v-if="dish.tags?.length" class="flex flex-wrap gap-1 mt-1.5 mb-2">
          <span 
            v-for="tag in dish.tags.slice(0, 3)" 
            :key="tag" 
            class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
          >
            {{ tag }}
          </span>
        </view>
      </view>
      <view class="flex justify-between items-center mt-auto">
        <span class="text-orange-500 font-bold text-lg">¥{{ dish.price.toFixed(1) }}</span>
        <view class="flex items-center bg-yellow-50 px-2 py-1 rounded">
          <text class="text-yellow-500" style="font-size: 16px; line-height: 1;">★</text>
          <span class="text-yellow-600 ml-1 font-semibold text-sm">{{ dish.averageRating === 0 ? '暂无' : dish.averageRating.toFixed(1) }}</span>
          <span v-if="dish.averageRating !== 0" class="text-gray-400 text-xs ml-1">分</span>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Dish } from '@/types/api';

const props = defineProps<{
  dish: Dish;
}>();

const goToDetail = () => {
  uni.navigateTo({
    url: `/pages/dish/index?id=${props.dish.id}`
  });
};
</script>

