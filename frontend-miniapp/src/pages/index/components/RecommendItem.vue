<template>
  <view class="dish-card" @click="goToDetail">
    <image :src="displayImage" mode="aspectFill" class="dish-image" />
    <view class="dish-info">
      <text class="dish-name">{{ dish.name }}</text>
      <text class="dish-location">{{ dish.canteenName }} · {{ dish.windowName }}</text>
      <view class="dish-footer">
        <text class="dish-price">¥{{ dish.price.toFixed(1) }}</text>
        <view class="dish-rating">
          <uni-icons type="star-filled" color="#FFA726" size="16"></uni-icons>
          <text class="rating-text">{{ dish.averageRating.toFixed(1) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Dish } from '@/types/api';

const props = defineProps<{
  dish: Dish;
}>();

// computed 用于处理可能为空的字段，增加代码健壮性
const displayImage = computed(() => {
  return (props.dish.images && props.dish.images.length > 0)
    ? props.dish.images[0]
    : '/static/images/default-dish.png'; 
});

const goToDetail = () => {
  uni.navigateTo({
    // 假设菜品详情页在分包中
    url: `/subPackages/canteen/dish-detail?id=${props.dish.id}`,
  });
};
</script>

<style lang="scss" scoped>
.dish-card {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.dish-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  margin-right: 12px;
  flex-shrink: 0;
  background-color: #f5f5f5;
}
.dish-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.dish-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}
.dish-location {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
.dish-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dish-price {
  font-size: 16px;
  font-weight: bold;
  color: #FF6B35;
}
.dish-rating {
  display: flex;
  align-items: center;
  color: #FFA726;
  .rating-text {
    margin-left: 4px;
    font-size: 14px;
  }
}
</style>