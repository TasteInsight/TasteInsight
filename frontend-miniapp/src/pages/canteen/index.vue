<template>
  <view class="dish-list-page page-content">
    <CanteenHeader
      :canteen="canteenInfo"
      :loading="loading"
      :error="error"
      @retry="retryCanteen"
    />

    <view v-if="currentCanteenId" class="dish-list-search">
      <SearchBar placeholder="搜索这个食堂的菜品" :search-url="searchUrl" />
    </view>

    <!-- 窗口列表 -->
    <CanteenWindowList :windows="windows" @click="goToWindow" />

    <view class="px-4">
      <CanteenFilterBar
        ref="filterBarRef"
        :filter="currentFilter"
        @filter-change="handleFilterChange"
      />
    </view>

    <view class="dish-list-heading"><text class="dish-list-title">菜品</text></view>
    <view class="dish-list-content" :aria-busy="dishesLoading">
      <view v-if="dishesLoading && dishes.length" class="dish-list-state">正在更新菜品…</view>

      <view v-if="dishesError" class="dish-list-state" role="alert">
        <text>{{ dishesError }}</text>
        <button class="dish-list-action" @click="retryDishes">重新加载</button>
      </view>

      <view v-if="dishes.length > 0">
        <CanteenDishCard
          v-for="dish in dishes"
          :key="dish.id"
          :dish="dish"
          @click="goToDishDetail"
        />

        <!-- 上拉加载更多：底部提示/动画 -->
        <view class="dish-list-footer">
          <template v-if="dishesLoadingMore">
            <view
              class="w-4 h-4 mr-2 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin"
            ></view>
            <text>加载中...</text>
          </template>
          <template v-else-if="hasMore && !dishesError && !dishesLoading">
            <button class="dish-list-action" @click="loadMoreDishes">加载更多</button>
          </template>
          <template v-else-if="!hasMore && !dishesError && !dishesLoading">
            <text>没有更多了</text>
          </template>
        </view>
      </view>

      <view
        v-else-if="dishesInitialized && !dishesLoading && !dishesError && !error"
        class="dish-list-state"
      >
        <text>暂无菜品信息</text>
        <text class="dish-list-hint">可以调整筛选条件，或查看其他窗口。</text>
      </view>
    </view>
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
import CanteenFilterBar from './components/CanteenFilterBar.vue';
import CanteenHeader from './components/CanteenHeader.vue';
import CanteenDishCard from './components/CanteenDishCard.vue';
import CanteenWindowList from './components/CanteenWindowList.vue';
import type { GetDishesRequest } from '@/types/api';

const {
  canteenInfo,
  loading,
  error,
  windows,
  dishes,
  dishesInitialized,
  dishesLoading,
  dishesError,
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
    `/pages/search/index?canteenId=${encodeURIComponent(currentCanteenId.value)}&scopeName=${encodeURIComponent(canteenInfo.value?.name || '当前食堂')}`
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
    uni.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1500,
    });
  } catch (err) {
    if (!isCurrent()) return;
    console.error('下拉刷新失败:', err);
    uni.showToast({
      title: '刷新失败',
      icon: 'none',
    });
  } finally {
    if (isCurrent()) {
      uni.stopPullDownRefresh();
    }
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
onShow(() => {
  void refreshPreferredSort();
});

// 触底上拉加载更多
onReachBottom(async () => {
  if (!dishesError.value) await loadMoreDishes();
});
</script>

<style scoped src="@/styles/dish-list-page.css"></style>
