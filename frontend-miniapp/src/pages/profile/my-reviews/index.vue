<template>
  <view class="page-content dish-list-page page-state-layout">
    <LoginGate title="登录后查看个人记录" icon="user">
      <view class="dish-list-content page-state-content">
        <AsyncState
          :loading="loading"
          :initialized="initialized"
          :has-content="!!reviews.length"
          :error="error"
          empty-title="暂无评价"
          empty-icon="star"
          @retry="retry"
        />
        <template v-if="reviews.length">
          <ReviewCard
            v-for="item in reviews"
            :key="item.id"
            :review="item"
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
import ReviewCard from './components/ReviewCard.vue';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
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
