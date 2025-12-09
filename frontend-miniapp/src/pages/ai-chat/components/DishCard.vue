<template>
  <view class="dish-card" @click="goToDishDetail">
    <view class="flex">
      <image :src="dish.dish.image || '/default-dish.png'" class="dish-image" mode="aspectFill" />
      <view class="flex-grow ml-3">
        <view class="dish-name">{{ dish.dish.name }}</view>
        <view class="dish-location">{{ dish.canteenName }} {{ dish.windowName }}</view>
        <view class="flex items-center mt-1">
          <text class="rating-icon">★</text>
          <text class="rating-text">{{ dish.dish.rating }}</text>
        </view>
        <view v-if="dish.recommendReason" class="ai-reason">
          <text class="text-xs text-gray-500">推荐理由: </text>
          <text class="text-xs text-primary">{{ dish.recommendReason }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { ComponentDishCard } from '@/types/api';

const props = defineProps<{
  dish: ComponentDishCard;
}>();

const goToDishDetail = () => {
  if (props.dish.dish.id) {
    uni.navigateTo({
      url: `/pages/canteen/dish-detail?id=${props.dish.dish.id}`,
    });
  }
};
</script>

<style scoped lang="scss">
.dish-card {
  background: white;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}

.dish-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  flex-shrink: 0;
}

.dish-name {
  font-weight: 500;
  font-size: 16px;
}

.dish-location {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.rating-icon, .rating-text {
  color: #FFA726;
  font-size: 14px;
  margin-right: 4px;
}

.ai-reason {
    margin-top: 6px;
    font-size: 12px;
    
    .text-primary {
        color: #82318E;
    }
}
</style>
