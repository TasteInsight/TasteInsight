<template>
  <view class="dish-list-page page-viewport flex flex-col">
    <!-- 窗口信息和菜品列表 - 支持下拉刷新 -->
    <scroll-view
      class="window-scroll"
      scroll-y="true"
      enable-flex="true"
      refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onRefresh"
      @refresherrestore="onRefreshRestore"
      lower-threshold="80"
      @scrolltolower="onLoadMore"
    >
      <!-- 窗口信息 -->
      <WindowHeader
        :window="windowInfo"
        :loading="headerLoading"
        :error="headerError"
        @retry="retryHeader"
      />

      <view v-if="currentWindowId" class="dish-list-search">
        <SearchBar placeholder="搜索这个窗口的菜品" :search-url="searchUrl" />
      </view>

      <!-- 菜品列表 -->
      <view class="dish-list-heading"><text class="dish-list-title">窗口菜品</text></view>
      <view class="dish-list-content" :aria-busy="loading">
        <view v-if="loading && dishes.length" class="dish-list-state">正在更新菜品…</view>

        <view v-if="error" class="dish-list-state" role="alert">
          <text>{{ error }}</text>
          <button class="dish-list-action" @click="retryDishes">重新加载</button>
        </view>

        <view v-if="dishes.length > 0">
          <CanteenDishCard
            v-for="dish in dishes"
            :key="dish.id"
            :dish="dish"
            @click="goToDishDetail"
          />
        </view>

        <view
          v-else-if="dishesInitialized && !loading && !error && !headerError"
          class="dish-list-state"
        >
          <text>暂无菜品信息</text>
          <text class="dish-list-hint">可以返回食堂，看看其他窗口。</text>
        </view>

        <view
          v-if="!loading && !error && (dishes.length > 0 || loadingMore)"
          class="dish-list-footer"
        >
          <template v-if="loadingMore">
            <view
              class="w-4 h-4 mr-2 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin"
            ></view>
            <text>加载中...</text>
          </template>
          <template v-else-if="hasMore">
            <button class="dish-list-action" @click="onLoadMore">加载更多</button>
          </template>
          <template v-else>
            <text>没有更多了</text>
          </template>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import WindowHeader from './components/WindowHeader.vue';
import SearchBar from '@/components/SearchBar.vue';
import CanteenDishCard from '../canteen/components/CanteenDishCard.vue';

const {
  windowInfo,
  loading,
  loadingMore,
  hasMore,
  error,
  headerError,
  headerLoading,
  dishes,
  dishesInitialized,
  beginOperation,
  init,
  fetchDishes,
  loadMoreDishes,
  fetchWindow,
  retryDishes,
  refreshPreferredSort,
} = useWindowData();

const currentWindowId = ref('');
const searchUrl = computed(
  () =>
    `/pages/search/index?windowId=${encodeURIComponent(currentWindowId.value)}&scopeName=${encodeURIComponent(windowInfo.value?.name || '当前窗口')}`
);
const refresherTriggered = ref(false);

onLoad(async (options: any) => {
  if (options.id) {
    const isCurrent = beginOperation();
    currentWindowId.value = options.id;
    await init(options.id, isCurrent);
  }
});

/**
 * 下拉刷新处理
 */
const onRefresh = async () => {
  if (!currentWindowId.value) return;
  const isCurrent = beginOperation();

  refresherTriggered.value = true;

  try {
    // 同时刷新窗口信息和菜品列表
    await Promise.all([
      fetchWindow(currentWindowId.value, isCurrent),
      fetchDishes(currentWindowId.value, undefined, undefined, isCurrent),
    ]);
  } catch (err) {
    if (!isCurrent()) return;
    console.error('刷新失败:', err);
  } finally {
    if (isCurrent()) refresherTriggered.value = false;
  }
};

/**
 * 刷新恢复处理
 */
const onRefreshRestore = () => {
  refresherTriggered.value = false;
};

/**
 * 触底上拉加载更多（scroll-view）
 */
const onLoadMore = async () => {
  if (!currentWindowId.value || refresherTriggered.value) return;
  if (!hasMore.value || error.value) return;
  await loadMoreDishes(currentWindowId.value);
};

const retryHeader = () => init(currentWindowId.value);
onShow(() => {
  void refreshPreferredSort();
});
const goToDishDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
</script>

<style scoped src="@/styles/dish-list-page.css"></style>
<style scoped>
.window-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
}
</style>
