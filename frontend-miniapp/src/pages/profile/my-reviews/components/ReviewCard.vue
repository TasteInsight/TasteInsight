<template>
  <view 
    class="bg-white rounded-xl p-4 border border-gray-200"
    @click="$emit('click')"
  >
    <!-- 评价头部：时间和评分 -->
    <view class="flex items-center justify-between mb-3">
      <text class="text-gray-500 text-sm">{{ formattedDate }}</text>
      <view class="flex items-center">
        <text
          v-for="star in 5"
          :key="star"
          class="iconify"
          :class="star <= review.rating ? 'text-yellow-500' : 'text-gray-300'"
          data-icon="mdi:star"
          data-width="16"
        ></text>
        <text class="ml-2 text-gray-700 font-medium">{{ review.rating.toFixed(1) }}</text>
      </view>
    </view>

    <!-- 评价内容 -->
    <view v-if="review.content" class="mb-3">
      <text class="text-gray-800 text-base leading-relaxed">{{ review.content }}</text>
    </view>

    <!-- 评价图片 -->
    <view v-if="review.images && review.images.length > 0" class="flex flex-wrap gap-2 mb-3">
      <image
        v-for="(img, index) in review.images.slice(0, 3)"
        :key="index"
        :src="img"
        class="w-20 h-20 rounded-lg"
        mode="aspectFill"
      />
    </view>

    <!-- 菜品信息 -->
    <view class="flex items-center border-t border-gray-100 pt-3">
      <!-- 菜品图片 -->
      <image
        :src="review.dishImage || '/static/images/default-dish.png'"
        class="w-16 h-16 rounded-lg mr-3"
        mode="aspectFill"
      />
      
      <!-- 菜品详情 -->
      <view class="flex-1">
        <text class="text-gray-900 font-medium text-base mb-1 block">{{ review.dishName }}</text>
        <view class="flex items-center justify-between">
          <text class="text-gray-500 text-sm">查看详情</text>
          <text class="iconify text-gray-400" data-icon="mdi:chevron-right" data-width="16"></text>
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
</script>
