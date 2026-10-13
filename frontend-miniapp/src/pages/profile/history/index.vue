<template>
  <view class="page-content dish-list-page">
    <view class="dish-list-content">
      <view v-if="error && historyItems.length === 0" class="error-feedback" role="alert">
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
        v-else-if="initialized && !historyItems.length"
        title="暂无浏览历史"
        icon="history"
      />
      <template v-else-if="historyItems.length">
        <DishCard
          v-for="item in historyItems"
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
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import DishCard from '@/pages/profile/components/ProfileDishCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useHistory } from './composables/use-history';
const { historyItems, loading, initialized, error, hasMore, loadMore, refresh, retry } =
  useHistory();
onShow(() => {
  void refresh();
});
onReachBottom(() => {
  if (!error.value) void loadMore();
});
onPullDownRefresh(async () => {
  try {
    if (await refresh()) uni.showToast({ title: '刷新成功', icon: 'success', duration: 1500 });
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
