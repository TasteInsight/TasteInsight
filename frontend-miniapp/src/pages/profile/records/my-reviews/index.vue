<template>
  <view class="page-content dish-list-page page-state-layout">
    <LoginGate :title="t('account.profile.signInToViewYour')" icon="user">
      <view class="dish-list-content page-state-content">
        <AsyncState
          :loading="loading"
          :initialized="initialized"
          :has-content="!!reviews.length"
          :error="error"
          :empty-title="t('account.profile.noReviewsYet2')"
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
            <button v-if="hasMore" class="dish-list-action" @click="loadMore">
              {{ t('account.profile.loadMore') }}
            </button>
            <text v-else>{{ t('account.profile.youVeReachedTheEnd') }}</text>
          </view>
        </template>
      </view>
    </LoginGate>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import ReviewCard from '@/pages/profile/components/ReviewCard.vue';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
import { useMyReviews } from '@/pages/profile/composables/use-my-reviews';
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
    fail: () => uni.showToast({ title: t('account.profile.unableToOpenPage'), icon: 'none' }),
  });
}
</script>
<style scoped>
@import '@/styles/dish-list-page.css';
</style>
