<template>
  <view class="page-content dish-list-page page-state-layout">
    <LoginGate title="登录后查看个人记录" icon="user">
      <view class="dish-list-content page-state-content">
        <AsyncState
          :loading="loading"
          :initialized="initialized"
          :has-content="!!favoriteItems.length"
          :error="error"
          empty-title="暂无收藏"
          empty-icon="bookmark"
          @retry="retry"
        />
        <template v-if="favoriteItems.length">
          <DishCard
            v-for="item in favoriteItems"
            :key="item.dishId"
            :dish="{
              id: item.dishId,
              name: item.dishName,
              images: item.dishImages,
              price: item.dishPrice,
              priceUnit: item.priceUnit,
              status: item.status,
              calories: item.calories,
              protein: item.protein,
              carbohydrate: item.carbohydrate,
              fat: item.fat,
              canteenName: item.canteenName,
              windowName: item.windowName,
              tags: item.tags,
              averageRating: item.averageRating,
            }"
            :show-favorite="true"
            :favorite-disabled="loading || removingIds.includes(item.dishId)"
            :removing="removingIds.includes(item.dishId)"
            @unfavorite="removeFavorite(item.dishId)"
            @click="goToDishDetail(item.dishId)"
          />
          <view v-if="!loading && !error" class="dish-list-footer">
            <button v-if="hasMore" class="dish-list-action" @click="loadMore">加载更多</button>
            <text v-else>没有更多了</text>
          </view>
        </template>
      </view>
    </LoginGate>
  </view>
</template>
<script setup lang="ts">
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import DishCard from '@/pages/profile/components/ProfileDishCard.vue';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
import { useFavorites } from './composables/use-favorites';
const {
  favoriteItems,
  loading,
  initialized,
  error,
  hasMore,
  loadMore,
  refresh,
  retry,
  removeFavorite,
  removingIds,
} = useFavorites();
onShow(() => {
  void refresh();
});
onReachBottom(() => {
  if (!error.value) void loadMore();
});
onPullDownRefresh(async () => {
  try {
    await refresh();
  } finally {
    uni.stopPullDownRefresh();
  }
});
function goToDishDetail(dishId: string) {
  uni.navigateTo({
    url: `/pages/dish/index?id=${dishId}`,
    fail: () => uni.showToast({ title: '页面跳转失败', icon: 'none' }),
  });
}
</script>
<style scoped src="@/styles/dish-list-page.css"></style>
