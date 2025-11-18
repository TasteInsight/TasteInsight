<template>
  <view class="w-full min-h-screen bg-gray-50 pb-4">
    <!-- 加载状态 -->
    <view v-if="loading && dishes.length === 0" class="flex justify-center items-center py-20">
      <text class="text-gray-500">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading && dishes.length === 0" class="flex flex-col items-center justify-center py-20">
      <text class="iconify text-gray-300 mb-4" data-icon="mdi:heart-outline" data-width="64"></text>
      <text class="text-gray-500">暂无收藏</text>
    </view>

    <!-- 菜品列表 -->
    <view v-else class="px-4 pt-4 space-y-4">
      <DishCard
        v-for="dish in dishes"
        :key="dish.id"
        :dish="dish"
        :show-favorite="true"
        @click="goToDishDetail(dish.id)"
        @unfavorite="handleUnfavorite(dish.id)"
      />
    </view>

    <!-- 加载更多 -->
    <view v-if="hasMore && !loading" class="flex justify-center py-4">
      <text class="text-gray-500 text-sm" @click="loadMore">加载更多</text>
    </view>

    <!-- 底部加载状态 -->
    <view v-if="loading && dishes.length > 0" class="flex justify-center py-4">
      <text class="text-gray-500 text-sm">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import DishCard from './components/DishCard.vue';
import { useFavorites } from '@/pages/profile/my-favorites/composables/use-favorites';

const { dishes, loading, hasMore, fetchFavorites, loadMore, removeFavorite } = useFavorites();

onMounted(() => {
  fetchFavorites();
});

/**
 * 跳转到菜品详情页
 */
function goToDishDetail(dishId: string) {
  uni.navigateTo({
    url: `/pages/dish/detail?id=${dishId}`,
    fail: () => {
      uni.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    }
  });
}

/**
 * 取消收藏
 */
async function handleUnfavorite(dishId: string) {
  await removeFavorite(dishId);
}
</script>
