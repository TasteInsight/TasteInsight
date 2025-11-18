<template>
  <view 
    class="bg-white rounded-xl p-4 border border-gray-200 flex"
    @click="$emit('click')"
  >
    <!-- 菜品图片 -->
    <image
      :src="dish.images && dish.images.length > 0 ? dish.images[0] : '/static/images/default-dish.png'"
      class="w-24 h-24 rounded-lg mr-4 flex-shrink-0"
      mode="aspectFill"
    />
    
    <!-- 菜品信息 -->
    <view class="flex-1 flex flex-col justify-between">
      <!-- 名称和评分 -->
      <view>
        <text class="text-gray-900 font-medium text-base mb-2 block">{{ dish.name }}</text>
        
        <!-- 平均评分 -->
        <view class="flex items-center mb-2">
          <text
            v-for="star in 5"
            :key="star"
            class="iconify"
            :class="star <= Math.round(dish.averageRating) ? 'text-yellow-500' : 'text-gray-300'"
            data-icon="mdi:star"
            data-width="14"
          ></text>
          <text class="ml-1 text-gray-600 text-sm">{{ dish.averageRating.toFixed(1) }}</text>
          <text class="text-gray-400 text-xs ml-1">({{ dish.reviewCount }})</text>
        </view>
      </view>

      <!-- 位置和价格 -->
      <view class="flex items-center justify-between">
        <view class="flex items-center">
          <text class="iconify text-gray-400 mr-1" data-icon="mdi:map-marker" data-width="14"></text>
          <text class="text-gray-600 text-sm">{{ dish.canteenName }} · {{ dish.windowName }}</text>
        </view>
        <text class="text-ts-purple font-semibold text-base">¥{{ dish.price.toFixed(2) }}</text>
      </view>

      <!-- 收藏按钮 (可选) -->
      <view v-if="showFavorite" class="absolute top-4 right-4">
        <text 
          class="iconify text-red-500" 
          data-icon="mdi:heart" 
          data-width="20"
          @click.stop="$emit('unfavorite')"
        ></text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Dish } from '@/types/api';

defineProps<{
  dish: Dish;
  showFavorite?: boolean;
}>();

defineEmits(['click', 'unfavorite']);
</script>
