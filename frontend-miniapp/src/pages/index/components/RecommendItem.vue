<!-- @/components/RecommendItem.vue -->
<template>
  <view 
    class="flex py-3 border-b border-gray-200 cursor-pointer" 
    :data-allergen="dish.allergens?.join(',') || '无'"
    @click="goToDetail"
  >
    <img :src="dish.images[0] || '/default-dish.png'" :alt="dish.name" class="w-20 h-20 rounded-lg mr-3" style="object-fit:cover" />
    <view class="flex-grow">
      <h3 class="font-medium">{{ dish.name }}</h3>
      <p class="text-sm text-gray-500 mt-1">{{ dish.canteenName }} {{ dish.floor || '' }}-{{ dish.windowName }}</p>
      <view class="flex justify-between items-center mt-2">
        <span class="text-orange-500 font-bold">¥{{ dish.price.toFixed(1) }}</span>
        <view class="flex items-center">
          <span class="iconify text-yellow-500" data-icon="mdi:star" data-width="16"></span>
          <span class="text-yellow-500 ml-1">{{ dish.averageRating.toFixed(1) }}</span>
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

