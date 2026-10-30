<template>
  <view class="page-content dish-list-page page-state-layout">
    <LoginGate :title="t('account.profile.signInToViewYour')" icon="user">
      <view class="dish-list-content page-state-content">
        <AsyncState
          :loading="loading"
          :initialized="initialized"
          :has-content="!!historyItems.length"
          :error="error"
          :empty-title="t('account.profile.noBrowsingHistoryYet')"
          empty-icon="history"
          @retry="retry"
        />
        <template v-if="historyItems.length">
          <DishCard
            v-for="item in historyItems"
            :key="item.dishId"
            :dish="{
              id: item.dishId,
              name: item.dishName,
              nameEn: item.dishNameEn,
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
import DishCard from '@/pages/profile/records/components/ProfileDishCard.vue';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
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
