<template>
  <!-- 评分比例条状图 -->
  <view class="w-52">
    <view
      v-for="item in ratingBars"
      :key="item.stars"
      class="mb-1.5 last:mb-0"
    >
      <view class="flex items-center gap-1.5">
        <text class="text-[10px] text-gray-500 font-medium min-w-[20px] text-center">{{ item.stars }}星</text>
        <view class="flex-1 h-1 bg-gray-100 rounded overflow-hidden">
          <view
            class="h-full rounded bg-gradient-to-r from-yellow-300 to-yellow-400 transition-[width] duration-300"
            :style="{ width: item.percentage + '%' }"
          ></view>
        </view>
        <text class="text-[10px] text-gray-400 font-medium min-w-[24px] text-right">{{ item.percentage }}%</text>
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
/* RatingBars component styles */
</style>
