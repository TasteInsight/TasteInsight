<template>
  <view class="page-content dish-list-page page-state-layout">
    <EmptyState
      v-if="!isLoggedIn"
      class="page-state-region"
      title="登录后查看个人记录"
      icon="user"
      action-text="登录"
      @action="openLogin"
    />
    <view v-else class="dish-list-content page-state-content">
      <view
        v-if="error && favoriteItems.length === 0"
        class="error-feedback page-state-region"
        role="alert"
      >
        <text class="error-feedback__message">{{ error }}</text
        ><button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="retry"
        >
          重新加载
        </button>
      </view>
      <EmptyState
        class="page-state-region"
        v-else-if="initialized && !favoriteItems.length"
        title="暂无收藏"
        icon="bookmark"
      />
      <EmptyState
        v-else-if="loading && !initialized"
        class="page-state-region"
        title="正在加载…"
        loading
      />
      <template v-else-if="favoriteItems.length">
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
        <view v-if="error" class="error-feedback" role="alert">
          <text class="error-feedback__message">{{ error }}</text
          ><button
            class="error-feedback__action"
            hover-class="error-feedback__action--pressed"
            :disabled="loading"
            @click="retry"
          >
            重试
          </button>
        </view>
        <view v-else class="dish-list-footer">
          <text v-if="loading">加载中…</text>
          <button v-else-if="hasMore" class="dish-list-action" @click="loadMore">加载更多</button>
          <text v-else>没有更多了</text>
        </view>
      </template>
    </view>
  </view>
</template>
<script setup lang="ts">
import { openLogin } from '@/utils/login-navigation';
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import DishCard from '@/pages/profile/components/ProfileDishCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useFavorites } from './composables/use-favorites';
const {
  isLoggedIn,
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
