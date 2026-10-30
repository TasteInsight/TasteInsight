<template>
  <view class="dish-list-page page-content page-state-layout">
    <CanteenHeader
      :class="{ 'page-state-content': !!error && !dishesInitialized }"
      :canteen="canteenInfo"
      :loading="loading"
      :error="error"
      @retry="retryCanteen"
    />

    <view
      v-if="currentCanteenId"
      :class="{ 'dish-list-search--before-state': error && !dishesInitialized }"
      class="dish-list-search"
    >
      <SearchBar :placeholder="t('food.searchDishesInThisCanteen')" :search-url="searchUrl" />
    </view>

    <template v-if="!error || dishesInitialized">
      <!-- 窗口列表 -->
      <CanteenWindowList :windows="windows" @click="goToWindow" />

      <view class="px-4">
        <CanteenFilterBar
          ref="filterBarRef"
          :filter="currentFilter"
          @filter-change="handleFilterChange"
        />
      </view>

      <view class="dish-list-heading"
        ><text class="dish-list-title">{{ t('food.dishes2') }}</text></view
      >
      <view
        class="dish-list-content page-state-content"
        :aria-busy="dishesLoading || dishesLoadingMore"
      >
        <AsyncState
          v-if="canteenInfo && !error"
          :loading="dishesLoading"
          :initialized="dishesInitialized"
          :has-content="!!dishes.length"
          :error="dishErrorIsAppend ? '' : dishesError"
          :loading-title="t('food.loadingDishes')"
          :empty-title="t('food.noDishInformationYet')"
          empty-icon="search"
          @retry="retryDishes"
        />

        <view v-if="dishes.length > 0">
          <CanteenDishCard
            v-for="dish in dishes"
            :key="dish.id"
            :dish="dish"
            @click="goToDishDetail"
          />

          <AsyncState
            :loading="dishesLoadingMore"
            has-content
            :error="dishErrorIsAppend ? dishesError : ''"
            :refreshing-title="t('food.loadingMore')"
            @retry="retryDishes"
          />
          <view class="dish-list-footer">
            <template v-if="hasMore && !dishesError && !dishesLoading && !dishesLoadingMore">
              <button class="dish-list-action" @click="loadMoreDishes">
                {{ t('food.loadMore') }}
              </button>
            </template>
            <template v-else-if="!hasMore && !dishesError && !dishesLoading && !dishesLoadingMore">
              <text>{{ t('food.youVeReachedTheEnd') }}</text>
            </template>
          </view>
        </view>
      </view>
    </template>

    <!-- #ifdef MP-WEIXIN -->
    <page-container
      :show="isFilterOpen"
      :overlay="false"
      :duration="0"
      :disable-scroll="false"
      data-testid="canteen-filter-back-helper"
      custom-style="position: fixed; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="closeFilters"
    />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { computed, ref } from 'vue';
import {
  onLoad,
  onPullDownRefresh,
  onReachBottom,
  onBackPress,
  onHide,
  onShow,
} from '@dcloudio/uni-app';
import { useCanteenData } from './composables/use-canteen-data';
import SearchBar from '@/components/SearchBar.vue';
import AsyncState from '@/components/AsyncState.vue';
import CanteenFilterBar from './components/CanteenFilterBar.vue';
import CanteenHeader from './components/CanteenHeader.vue';
import CanteenDishCard from './components/CanteenDishCard.vue';
import CanteenWindowList from './components/CanteenWindowList.vue';
import type { GetDishesRequest } from '@/types/api';
import { useSessionRefresh } from '@/composables/use-session-refresh';

const {
  canteenInfo,
  loading,
  error,
  windows,
  dishes,
  dishesInitialized,
  dishesLoading,
  dishesError,
  dishErrorIsAppend,
  dishesLoadingMore,
  hasMore,
  beginOperation,
  init,
  fetchDishes,
  loadMoreDishes,
  retryDishes,
  refreshPreferredSort,
} = useCanteenData();

const currentCanteenId = ref('');
const searchUrl = computed(
  () =>
    `/pages/search/index?canteenId=${encodeURIComponent(currentCanteenId.value)}&scopeName=${encodeURIComponent(canteenInfo.value?.name || t('food.thisCanteen'))}`
);
const currentFilter = ref<GetDishesRequest['filter']>({});
const filterBarRef = ref<InstanceType<typeof CanteenFilterBar> | null>(null);
const isFilterOpen = computed(() => !!filterBarRef.value?.isOpen);
const closeFilters = () => filterBarRef.value?.closePanel();

onBackPress(() => {
  if (!isFilterOpen.value) return false;
  closeFilters();
  return true;
});
onHide(closeFilters);

// 页面加载时获取参数并初始化
onLoad(async (options: any) => {
  if (options.id) {
    const isCurrent = beginOperation();
    currentCanteenId.value = options.id;
    await init(options.id, {}, isCurrent);
  }
});

// 下拉刷新处理
onPullDownRefresh(async () => {
  const isCurrent = beginOperation();
  try {
    if (currentCanteenId.value) {
      const refreshed = await init(currentCanteenId.value, currentFilter.value, isCurrent);
      if (!refreshed) return;
    }
    if (!isCurrent()) return;
  } catch (err) {
    if (!isCurrent()) return;
    console.error('下拉刷新失败:', err);
  } finally {
    uni.stopPullDownRefresh();
  }
});

const goToDishDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
const goToWindow = (id: string) => uni.navigateTo({ url: `/pages/window/index?id=${id}` });

const handleFilterChange = (filter: GetDishesRequest['filter']) => {
  currentFilter.value = filter;
  if (currentCanteenId.value) {
    fetchDishes(currentCanteenId.value, filter);
  }
};

const retryCanteen = () => init(currentCanteenId.value, currentFilter.value);
useSessionRefresh(retryCanteen, () => !!currentCanteenId.value);
onShow(() => {
  void refreshPreferredSort();
});

// 触底上拉加载更多
onReachBottom(async () => {
  if (!dishesError.value) await loadMoreDishes();
});
</script>

<style scoped>
@import '@/styles/dish-list-page.css';
</style>
