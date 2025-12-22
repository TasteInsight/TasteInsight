<template>
  <view class="w-full min-h-screen bg-white pb-4">
    <!-- 骨架屏：首次加载时显示 -->
    <DishListSkeleton v-if="loading && dishes.length === 0" />

    <template v-else>
    <!-- 标题栏 -->
    <view class="text-base font-semibold text-gray-800 flex items-center px-4 py-3 border-b border-gray-100">
      <view class="w-1 h-4 bg-ts-purple rounded-full mr-2"></view>
      历史浏览
    </view>

    <!-- 空状态 -->
    <view v-if="!loading && dishes.length === 0" class="flex flex-col items-center justify-center py-20">
      <text class="iconfont icon-history text-gray-300 mb-4" data-width="64"></text>
      <text class="text-gray-500">暂无浏览历史</text>
    </view>

    <!-- 菜品列表 -->
    <view v-else class="px-4">
      <DishCard
        v-for="dish in dishes"
        :key="dish.id"
        :dish="dish"
        @click="goToDishDetail(dish.id)"
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
    </template>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import DishCard from '@/pages/profile/components/ProfileDishCard.vue';
import { useHistory } from '@/pages/profile/history/composables/use-history';
import { DishListSkeleton } from '@/components/skeleton';

const { dishes, loading, hasMore, fetchHistory, loadMore } = useHistory();

onMounted(() => {
  fetchHistory();
});

// 触底上拉加载更多
onReachBottom(async () => {
  await loadMore();
});

// 下拉刷新处理
onPullDownRefresh(async () => {
  try {
    await fetchHistory(true); // 传入 true 表示刷新
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
</script>
