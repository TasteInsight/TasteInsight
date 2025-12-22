<template>
  <view class="w-full min-h-screen bg-white pb-4">
    <!-- 骨架屏：首次加载时显示 -->
    <DishListSkeleton v-if="loading && favoriteItems.length === 0" />

    <template v-else>
    <!-- 标题栏 -->
    <view class="text-base font-semibold text-gray-800 flex items-center px-4 py-3 border-b border-gray-100">
      <view class="w-1 h-4 bg-ts-purple rounded-full mr-2"></view>
      我的收藏
    </view>

    <!-- 空状态 -->
    <view v-if="!loading && favoriteItems.length === 0" class="flex flex-col items-center justify-center py-20">
      <text class="iconfont icon-heart-outline text-gray-300 mb-4" data-width="64"></text>
      <text class="text-gray-500">暂无收藏</text>
    </view>

    <!-- 菜品列表 -->
    <view v-else class="px-4">
      <DishCard
        v-for="item in favoriteItems"
        :key="item.dishId"
        :dish="{
          id: item.dishId,
          name: item.dishName,
          images: item.dishImages,
          price: item.dishPrice,
          canteenName: item.canteenName,
          windowName: item.windowName,
          tags: item.tags,
          averageRating: item.averageRating,
        }"
        :show-favorite="true"
        @click="goToDishDetail(item.dishId)"
        @unfavorite="handleUnfavorite(item.dishId)"
      />
    </view>

    <!-- 底部提示：上拉加载更多 / 没有更多了 -->
    <view v-if="favoriteItems.length > 0 && !loading" class="flex justify-center py-4">
      <text class="text-gray-500 text-sm" @click="hasMore ? loadMore() : undefined">{{ hasMore ? '上拉加载更多' : '没有更多了' }}</text>
    </view>

    <!-- 底部加载状态 -->
    <view v-if="loading && favoriteItems.length > 0" class="flex items-center justify-center py-4 text-gray-500 text-sm">
      <view class="w-4 h-4 mr-2 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin"></view>
      <text>加载中...</text>
    </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import DishCard from '@/pages/profile/components/ProfileDishCard.vue';
import { useFavorites } from '@/pages/profile/my-favorites/composables/use-favorites';
import { DishListSkeleton } from '@/components/skeleton';

const { favoriteItems, loading, hasMore, fetchFavorites, loadMore, removeFavorite } = useFavorites();

onMounted(() => {
  fetchFavorites();
});

// 触底上拉加载更多
onReachBottom(async () => {
  await loadMore();
});

// 下拉刷新处理
onPullDownRefresh(async () => {
  try {
    await fetchFavorites(true); // 传入 true 表示刷新
    uni.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1500
    });
  } catch (err) {
    console.error('下拉刷新失败:', err);
    uni.showToast({
      title: '刷新失败',
      icon: 'none'
    });
  } finally {
    uni.stopPullDownRefresh();
  }
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

/**
 * 取消收藏
 */
async function handleUnfavorite(dishId: string) {
  await removeFavorite(dishId);
}
</script>
