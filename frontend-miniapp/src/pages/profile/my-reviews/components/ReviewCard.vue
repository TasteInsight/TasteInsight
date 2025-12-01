<template>
  <view 
    class="bg-white p-4 border border-gray-200"
    @click="$emit('click')"
  >
    <!-- 评价头部：时间 -->
    <view class="flex items-center justify-between mb-3">
      <text class="text-gray-500 text-xs">{{ formattedDate }}</text>
      <!-- Optional: Status tag could go here -->
    </view>

    <!-- 评价内容 -->
    <view v-if="review.content" class="mb-3">
      <text class="text-gray-800 text-base leading-relaxed">{{ review.content }}</text>
    </view>

    <!-- 评价图片 -->
    <view v-if="validImages.length > 0" class="flex flex-wrap gap-2 mb-3">
      <image
        v-for="(img, index) in validImages.slice(0, 3)"
        :key="index"
        :src="img"
        class="w-20 h-20 rounded-lg"
        mode="aspectFill"
      />
    </view>
    
    <!-- 菜品信息 & 评分 -->
    <view class="flex items-center border-t border-gray-100 pt-3">
      <!-- 菜品图片 -->
      <image
        :src="review.dishImage || '/static/images/default-dish.png'"
        class="w-16 h-16 rounded-lg mr-3 flex-shrink-0"
        mode="aspectFill"
      />
      
      <!-- 菜品详情 & 评分 -->
      <view class="flex-1 flex flex-col justify-between h-16 py-0.5">
        <view class="flex justify-between items-start">
           <text class="text-gray-900 font-medium text-base line-clamp-1">{{ review.dishName }}</text>
           <!-- removed top right arrow -->
        </view>
        
        <!-- 评分 & 查看详情 -->
        <view class="flex items-center justify-between mt-auto">
          <view class="flex items-center">
            <view class="flex items-center mr-2">
              <text
                v-for="star in 5"
                :key="star"
                class="iconify"
                :class="star <= review.rating ? 'text-orange-400' : 'text-gray-200'"
                data-icon="mdi:star"
                data-width="14"
              ></text>
            </view>
            <text class="text-orange-500 font-semibold text-sm">{{ review.rating.toFixed(1) }}</text>
          </view>
          
          <!-- 查看详情 (Gray text + arrow) -->
          <view class="flex items-center">
             <text class="text-gray-400 text-xs mr-0.5">查看详情</text>
             <text class="iconify text-gray-400" data-icon="mdi:chevron-right" data-width="14"></text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MyReviewItem } from '@/types/api';
import dayjs from 'dayjs';

const props = defineProps<{
  review: MyReviewItem;
}>();

defineEmits(['click']);

const formattedDate = computed(() => {
  return dayjs(props.review.createdAt).format('YYYY-MM-DD HH:mm');
});

/**
 * 过滤无效图片（空字符串或 null）
 * 解决后端返回空字符串导致页面出现空白占位的问题
 */
const validImages = computed(() => {
  if (!props.review.images) return [];
  return props.review.images.filter(img => img && img.trim() !== '');
});
</script>
