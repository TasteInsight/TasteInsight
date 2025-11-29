<template>
  <!-- 评分比例条状图 -->
  <view class="rating-bars">
    <view
      v-for="item in ratingBars"
      :key="item.stars"
      class="rating-bar-item"
    >
      <view class="rating-bar-content">
        <text class="rating-stars">{{ item.stars }}星</text>
        <view class="rating-bar-container">
          <view
            class="rating-bar-fill"
            :style="{ width: item.percentage + '%' }"
          ></view>
        </view>
        <text class="rating-percentage">{{ item.percentage }}%</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { getReviewsByDish } from '@/api/modules/review';

interface Props {
  /** 菜品ID */
  dishId: string;
}

const props = defineProps<Props>();

// 评分详情数据
const ratingDetail = ref<Record<string, number> | null>(null);

/**
 * 获取评价列表及评分详情
 */
const fetchRatingDetail = async () => {
  if (!props.dishId) return;
  
  try {
    const response = await getReviewsByDish(props.dishId, { page: 1, pageSize: 1 });
    if (response.code === 200 && response.data?.rating?.detail) {
      ratingDetail.value = response.data.rating.detail;
    }
  } catch (error) {
    console.error('获取评分详情失败:', error);
  }
};

// 监听 dishId 变化
watch(() => props.dishId, () => {
  fetchRatingDetail();
}, { immediate: true });

/**
 * 计算评分比例数据
 */
const ratingBars = computed(() => {
  // 默认数据（当没有获取到 ratingDetail 时使用）
  const defaultRatings = [
    { stars: 5, percentage: 0 },
    { stars: 4, percentage: 0 },
    { stars: 3, percentage: 0 },
    { stars: 2, percentage: 0 },
    { stars: 1, percentage: 0 },
  ];

  if (!ratingDetail.value) {
    return defaultRatings;
  }

  // 计算总评价数
  const total = Object.values(ratingDetail.value).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return defaultRatings;
  }

  // 计算每个评分的百分比
  return [5, 4, 3, 2, 1].map(stars => {
    const count = ratingDetail.value?.[String(stars)] || 0;
    const percentage = Math.round((count / total) * 100);
    return { stars, percentage };
  });
});
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
  background: linear-gradient(90deg, #facc15 0%, #eab308 100%);
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
