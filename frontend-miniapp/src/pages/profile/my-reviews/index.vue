<template>
  <view class="page-content dish-list-page">
    <view class="dish-list-content">
      <view v-if="error && reviews.length === 0" class="dish-list-state" role="alert">
        <text>{{ error }}</text
        ><button class="dish-list-action" @click="retry">重新加载</button>
      </view>
      <view v-else-if="initialized && !reviews.length" class="dish-list-state">
        <text>暂无评价</text><text class="dish-list-hint">用餐后到菜品详情记录你的体验。</text>
      </view>
      <template v-else-if="reviews.length">
        <ReviewCard
          v-for="item in reviews"
          :key="item.id"
          :review="item"
          @click="goToDishDetail(item.dishId)"
        />
        <view v-if="error" class="dish-list-state list-append-error" role="alert">
          <text>{{ error }}</text
          ><button class="dish-list-action" :disabled="loading" @click="retry">重试</button>
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
import ReviewCard from './components/ReviewCard.vue';
import { useMyReviews } from './composables/use-my-reviews';
const { reviews, loading, initialized, error, hasMore, loadMore, refresh, retry } = useMyReviews();
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
<style scoped>
.list-append-error {
  min-height: 0;
  padding: 20px 0;
}
</style>
