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
      <view class="window-content page-state-layout">
        <!-- 窗口信息 -->
        <WindowHeader
          :class="{ 'page-state-content': !!headerError && !dishesInitialized }"
          :window="windowInfo"
          :loading="headerLoading"
          :error="headerError"
          @retry="retryHeader"
        />

        <view
          v-if="currentWindowId"
          :class="{ 'dish-list-search--before-state': headerError && !dishesInitialized }"
          class="dish-list-search"
        >
          <SearchBar :placeholder="t('food.searchDishesAtThisCounter')" :search-url="searchUrl" />
        </view>

        <template v-if="!headerError || dishesInitialized">
          <!-- 菜品列表 -->
          <view class="dish-list-heading"
            ><text class="dish-list-title">{{ t('food.counterDishes') }}</text></view
          >
          <view class="dish-list-content page-state-content" :aria-busy="loading || loadingMore">
            <AsyncState
              v-if="windowInfo && !headerError"
              :loading="loading"
              :initialized="dishesInitialized"
              :has-content="!!dishes.length"
              :error="errorIsAppend ? '' : error"
              :loading-title="t('food.loadingDishes')"
              :empty-title="t('food.noDishInformationYet')"
              empty-icon="search"
              @retry="retryDishes"
            />

            <view v-if="dishes.length > 0">
              <DishSummaryCard
                v-for="dish in dishes"
                :key="dish.id"
                :dish="dish"
                @select="goToDishDetail"
              />
              <AsyncState
                :loading="loadingMore"
                has-content
                :error="errorIsAppend ? error : ''"
                :refreshing-title="t('food.loadingMore')"
                @retry="retryDishes"
              />
            </view>

            <view
              v-if="!loading && !loadingMore && !error && dishes.length"
              class="dish-list-footer"
            >
              <template v-if="hasMore">
                <button class="dish-list-action" @click="onLoadMore">
                  {{ t('food.loadMore') }}
                </button>
              </template>
              <template v-else>
                <text>{{ t('food.youVeReachedTheEnd') }}</text>
              </template>
            </view>
          </view>
        </template>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { useSessionRefresh } from '@/composables/use-session-refresh';
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import WindowHeader from './components/WindowHeader.vue';
import SearchBar from '@/components/SearchBar.vue';
import AsyncState from '@/components/AsyncState.vue';
import DishSummaryCard from '@/components/DishSummaryCard.vue';

const {
  windowInfo,
  loading,
  loadingMore,
  hasMore,
  error,
  errorIsAppend,
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
    `/pages/search/index?windowId=${encodeURIComponent(currentWindowId.value)}&scopeName=${encodeURIComponent(windowInfo.value?.name || t('food.thisCounter'))}`
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
useSessionRefresh(retryHeader, () => !!currentWindowId.value);
onShow(() => {
  void refreshPreferredSort();
});
const goToDishDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
</script>

<style scoped>
@import '@/styles/dish-list-page.css';
</style>
<style scoped>
.window-content {
  min-height: 100%;
}
.window-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
}
</style>
