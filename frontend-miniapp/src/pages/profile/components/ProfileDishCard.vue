<template>
  <view 
    class="flex py-4 border-b border-gray-100 cursor-pointer bg-white transition-colors relative" 
    :class="{'hover:bg-gray-50': !isMobile}"
    @click="$emit('click')"
  >
    <!-- Image -->
    <image 
      :src="dish.images && dish.images[0] ? dish.images[0] : '/static/images/default-dish.png'" 
      mode="aspectFill"
      class="w-24 h-24 rounded-lg mr-4 flex-shrink-0" 
    />
    
    <!-- Content -->
    <view class="flex-grow flex flex-col justify-between overflow-hidden">
      <view>
        <view class="flex justify-between items-start">
          <text class="font-semibold text-base text-gray-800 truncate pr-6">{{ dish.name }}</text>
        </view>
        
        <text class="text-xs text-gray-500 mt-1 block">{{ dish.canteenName }} · {{ dish.windowName }}</text>
        
        <!-- Tags -->
        <view v-if="dish.tags?.length" class="flex flex-wrap gap-1 mt-1.5 mb-2">
          <text 
            v-for="tag in dish.tags.slice(0, 3)" 
            :key="tag" 
            class="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
          >
            {{ tag }}
          </text>
        </view>
      </view>
      
      <view class="flex justify-between items-center mt-auto">
        <text class="text-orange-500 font-bold text-lg">¥{{ dish.price.toFixed(1) }}</text>
        <view class="flex items-center bg-yellow-50 px-2 py-1 rounded">
          <text class="text-yellow-500" style="font-size: 16px; line-height: 1;">★</text>
          <text class="text-yellow-600 ml-1 font-semibold text-sm">{{ dish.averageRating === 0 ? '暂无' : dish.averageRating.toFixed(1) }}</text>
          <text v-if="dish.averageRating !== 0" class="text-gray-400 text-xs ml-1">分</text>
        </view>
      </view>
    </view>

    <!-- Favorite Button (Absolute Positioned) -->
    <view v-if="showFavorite" class="absolute top-4 right-2 p-2" @click.stop="$emit('unfavorite')">
      <text class="text-red-500" style="font-size: 20px; line-height: 1;">♥</text>
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

// Simple check for mobile environment to optionally disable hover effects if needed
// In uni-app, hover-class is usually preferred over :hover pseudo-classes
const isMobile = typeof uni !== 'undefined';
</script>

