<template>
  <view class="flex py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" @tap="handleClick">
    <img :src="dish.images && dish.images[0] || '/default-dish.png'" :alt="dish.name" class="w-20 h-20 rounded-lg mr-4" style="object-fit:cover" />
    <view class="flex-grow flex flex-col justify-between">
      <view>
        <h3 class="font-semibold text-base text-gray-800">{{ dish.name }}</h3>
        <p class="text-xs text-gray-500 mt-1">{{ dish.windowName }}</p>
        
        <!-- 标签展示 -->
        <view v-if="dish.tags && dish.tags.length > 0" class="flex flex-wrap mt-2 mb-1">
          <view
            v-for="(tag, index) in dish.tags.slice(0, 3)"
            :key="index"
            class="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded mr-1.5 mb-1"
          >
            {{ tag }}
          </view>
        </view>
      </view>
      
      <view class="flex justify-between items-center">
        <span class="text-orange-500 font-bold text-lg">¥{{ dish.price.toFixed(2) }}</span>
        <view class="flex items-center bg-yellow-50 px-2 py-1 rounded">
          <text class="text-yellow-500" style="font-size: 16px; line-height: 1;">★</text>
          <span class="text-yellow-600 ml-1 font-semibold text-sm">{{ dish.averageRating === 0 ? '暂无' : dish.averageRating.toFixed(2) }}</span>
          <span v-if="dish.averageRating !== 0" class="text-gray-400 text-xs ml-1">分</span>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Dish } from '@/types/api';
const props = defineProps<{ dish: Dish }>();
const emit = defineEmits(['click']);
const handleClick = () => emit('click', props.dish.id);
</script>
