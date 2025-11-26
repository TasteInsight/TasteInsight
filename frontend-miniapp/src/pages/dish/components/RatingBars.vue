<template>
  <!-- 评分比例条状图 -->
  <view class="rating-bars">
    <view
      v-for="rating in ratings"
      :key="rating.stars"
      class="rating-bar-item"
    >
      <view class="rating-bar-content">
        <text class="rating-stars">{{ rating.stars }}星</text>
        <view class="rating-bar-container">
          <view
            class="rating-bar-fill"
            :style="{ width: rating.percentage + '%' }"
          ></view>
        </view>
        <text class="rating-percentage">{{ rating.percentage }}%</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 评分比例数据 - 这里使用模拟数据，实际应用中应该从API获取
const ratings = [
  { stars: 5, percentage: 65 },
  { stars: 4, percentage: 20 },
  { stars: 3, percentage: 8 },
  { stars: 2, percentage: 4 },
  { stars: 1, percentage: 3 }
];
</script>

<style scoped>
.rating-bars {
  width: 200px; /* 进一步增加宽度，让条状图更长 */
}

.rating-bar-item {
  margin-bottom: 6px;
}

.rating-bar-item:last-child {
  margin-bottom: 0;
}

.rating-bar-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rating-stars {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
  min-width: 20px;
  text-align: center;
}

.rating-bar-container {
  flex: 1;
  height: 4px;
  background-color: #f3f4f6;
  border-radius: 2px;
  overflow: hidden;
}

.rating-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.rating-percentage {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 500;
  min-width: 24px;
  text-align: right;
}
</style>
