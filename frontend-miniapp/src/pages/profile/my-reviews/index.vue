<template>
  <view class="w-full min-h-screen bg-gray-50 pb-4">
    <!-- 标题栏 -->
    <view class="text-base font-semibold text-gray-800 flex items-center px-4 py-3 border-b border-gray-200 mb-3 bg-white">
      <view class="w-1 h-4 bg-ts-purple rounded-full mr-2"></view>
      我的评价
    </view>

    <!-- 加载状态 -->
    <view v-if="loading && reviews.length === 0" class="flex justify-center items-center py-20">
      <text class="text-gray-500">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading && reviews.length === 0" class="flex flex-col items-center justify-center py-20">
      <text class="iconify text-gray-300 mb-4" data-icon="mdi:comment-text-outline" data-width="64"></text>
      <text class="text-gray-500">暂无评价</text>
    </view>

    <!-- 评价列表 -->
    <view v-else class="px-4 pt-4 space-y-4">
      <ReviewCard
        v-for="review in reviews"
        :key="review.id"
        :review="review"
        @click="goToDishDetail(review.dishId)"
      />
    </view>

    <!-- 加载更多 -->
    <view v-if="hasMore && !loading" class="flex justify-center py-4">
      <text class="text-gray-500 text-sm" @click="loadMore">加载更多</text>
    </view>

    <!-- 底部加载状态 -->
    <view v-if="loading && reviews.length > 0" class="flex justify-center py-4">
      <text class="text-gray-500 text-sm">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import ReviewCard from './components/ReviewCard.vue';
import { useMyReviews } from '@/pages/profile/my-reviews/composables/use-my-reviews';

const { reviews, loading, hasMore, fetchReviews, loadMore } = useMyReviews();

onMounted(() => {
  fetchReviews();
});

/**
 * 跳转到菜品详情页
 */
function goToDishDetail(dishId: string) {
  uni.navigateTo({
    url: `/pages/dish/index?id=${dishId}`,
    fail: () => {
      uni.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    }
  });
}
</script>
