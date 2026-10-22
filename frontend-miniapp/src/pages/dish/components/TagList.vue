<template>
  <view class="dish-list-page page-content page-state-layout">
    <view class="dish-list-heading">
      <text class="dish-list-title">#{{ currentTag }}</text>
      <text class="dish-list-caption">{{
        canteenName ? t('food.relatedInCanteen', { canteen: canteenName }) : t('food.relatedDishes')
      }}</text>
    </view>
    <view class="dish-list-content page-state-content" :aria-busy="loading || loadingMore">
      <AsyncState
        :loading="loading"
        :initialized="initialized"
        :has-content="!!dishes.length"
        :error="errorIsAppend ? '' : error"
        :empty-title="t('food.noRelatedDishesYet')"
        empty-icon="search"
        @retry="loadDishes(!errorIsAppend)"
      />
      <view v-if="dishes.length > 0">
        <CanteenDishCard
          v-for="dish in dishes"
          :key="dish.id"
          :dish="dish"
          @click="goToDishDetail"
        />
        <AsyncState
          :loading="loadingMore"
          has-content
          :error="errorIsAppend ? error : ''"
          :refreshing-title="t('food.loadingMore')"
          @retry="loadDishes(false)"
        />
        <view v-if="!loading && !loadingMore && !error" class="dish-list-footer">
          <button v-if="hasMore" class="dish-list-action" @click="loadDishes()">
            {{ t('food.loadMore') }}
          </button>
          <text v-else>{{ t('food.youVeReachedTheEnd') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { ref, watch, onScopeDispose, watchEffect } from 'vue';
import { onLoad, onReachBottom, onShow } from '@dcloudio/uni-app';
import { getDishes } from '@/api/modules/dish';
import type { Dish } from '@/types/api';
import { useUserStore } from '@/store/modules/use-user-store';
import { getPreferredDishSort } from '@/utils/dish-sort';
import CanteenDishCard from '@/pages/canteen/components/CanteenDishCard.vue';
import AsyncState from '@/components/AsyncState.vue';
import { useSessionRefresh } from '@/composables/use-session-refresh';

const currentTag = ref('');
const canteenId = ref('');
const canteenName = ref('');
const dishes = ref<Dish[]>([]);
const initialized = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const errorIsAppend = ref(false);
const page = ref(1);
const pageSize = ref(10);
const hasMore = ref(true);
const userStore = useUserStore();
const preferredSort = () =>
  getPreferredDishSort(userStore.userInfo?.settings?.displaySettings?.sortBy);
let querySort = preferredSort();
let requestVersion = 0;
let disposed = false;
onScopeDispose(() => {
  disposed = true;
  requestVersion += 1;
});

onLoad((options: any) => {
  if (options.tag && options.canteenId) {
    const tag = decodeURIComponent(options.tag);
    if (currentTag.value !== tag || canteenId.value !== options.canteenId) {
      dishes.value = [];
      initialized.value = false;
      page.value = 1;
      hasMore.value = true;
    }
    currentTag.value = tag;
    canteenId.value = options.canteenId;
    canteenName.value = decodeURIComponent(options.canteenName || '');

    loadDishes(true);
  }
});

watchEffect(() => {
  uni.setNavigationBarTitle({ title: t('food.dishesByTag') });
});

const loadDishes = async (refresh = false) => {
  if (!refresh && (loading.value || loadingMore.value)) return;
  if (!refresh && !initialized.value) return;
  if (!refresh && !hasMore.value) return;
  if (!refresh && error.value && !errorIsAppend.value) return;

  const request = ++requestVersion;
  const session = userStore.sessionVersion;
  const ownsQuery = () =>
    !disposed && request === requestVersion && session === userStore.sessionVersion;
  loading.value = refresh;
  loadingMore.value = !refresh;
  error.value = '';
  errorIsAppend.value = !refresh;

  if (refresh) querySort = preferredSort();
  const requestedPage = refresh ? 1 : page.value + 1;

  try {
    const res = await getDishes({
      filter: {
        tag: [currentTag.value],
        canteenId: [canteenId.value],
        includeOffline: false,
      },
      search: {
        keyword: '',
      },
      sort: { ...querySort },
      pagination: {
        page: requestedPage,
        pageSize: pageSize.value,
      },
    });

    if (!ownsQuery()) return;
    if (res.code === 200 && res.data) {
      const newDishes = res.data.items || [];
      if (refresh) {
        dishes.value = newDishes;
      } else {
        dishes.value = [...dishes.value, ...newDishes];
      }

      page.value = res.data.meta.page ?? requestedPage;
      hasMore.value = page.value < res.data.meta.totalPages;
      initialized.value = true;
    } else {
      error.value = res.message || t('food.couldNotLoad');
    }
  } catch (err) {
    if (!ownsQuery()) return;
    error.value = t('food.connectionErrorTryAgainLater');
    console.error(err);
  } finally {
    if (ownsQuery()) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
};

onReachBottom(() => {
  if (!error.value) loadDishes();
});

useSessionRefresh(
  () => loadDishes(true),
  () => !!currentTag.value && !!canteenId.value
);
onShow(() => {
  if (canteenId.value && JSON.stringify(preferredSort()) !== JSON.stringify(querySort))
    loadDishes(true);
});
watch(
  () => userStore.sessionVersion,
  () => {
    requestVersion += 1;
    dishes.value = [];
    initialized.value = false;
    loading.value = false;
    loadingMore.value = false;
    error.value = '';
  },
  { flush: 'sync' }
);

const goToDishDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
};
</script>

<style scoped src="@/styles/dish-list-page.css"></style>
