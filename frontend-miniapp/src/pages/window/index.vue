<template>
  <view class="min-h-screen bg-white flex flex-col">
    <!-- 骨架屏 -->
    <WindowSkeleton v-if="isInitialLoading" />
    
    <template v-else>
      <!-- 搜索栏 -->
      <view class="px-4 flex-shrink-0">
        <CanteenSearchBar />
      </view>

      <!-- 窗口信息和菜品列表 - 支持下拉刷新 -->
      <scroll-view
        class="flex-1"
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
        <WindowHeader :window="windowInfo" />

        <!-- 菜品列表 -->
        <view class="px-4 pb-4">
          <view v-if="loading" class="text-center py-8 text-gray-500">
            加载中...
          </view>

          <view v-else-if="error" class="text-center py-8 text-red-500">
            {{ error }}
          </view>

          <view v-else-if="dishes.length > 0">
            <CanteenDishCard
              v-for="dish in dishes"
              :key="dish.id"
              :dish="dish"
              @click="goToDishDetail"
            />
          </view>

          <view v-if="loadingMore" class="flex items-center justify-center py-4 text-gray-500 text-sm">
            <view class="w-4 h-4 mr-2 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin"></view>
            <text>加载中...</text>
          </view>

          <view v-else class="text-center py-10 text-gray-500">
            暂无菜品信息
          </view>
        </view>
      </scroll-view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import WindowHeader from './components/WindowHeader.vue';
import CanteenSearchBar from '../canteen/components/CanteenSearchBar.vue';
import CanteenDishCard from '../canteen/components/CanteenDishCard.vue';
import { WindowSkeleton } from '@/components/skeleton';

const { windowInfo, loading, loadingMore, hasMore, error, dishes, init, fetchDishes, loadMoreDishes, fetchWindow } = useWindowData();

let currentWindowId = '';
const isInitialLoading = ref(true);
const refresherTriggered = ref(false);

onLoad(async (options: any) => {
  if (options.id) {
    currentWindowId = options.id;
    try {
      await init(options.id);
    } finally {
      isInitialLoading.value = false;
    }
  } else {
    isInitialLoading.value = false;
  }
});

/**
 * 下拉刷新处理
 */
const onRefresh = async () => {
  if (!currentWindowId) return;
  
  refresherTriggered.value = true;
  
  try {
    // 同时刷新窗口信息和菜品列表
    await Promise.all([
      fetchWindow(currentWindowId),
      fetchDishes(currentWindowId)
    ]);
  } catch (err) {
    console.error('刷新失败:', err);
  } finally {
    refresherTriggered.value = false;
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
  if (!currentWindowId) return;
  if (!hasMore.value) return;
  await loadMoreDishes(currentWindowId);
};

const goToSearch = () => uni.navigateTo({ url: '/pages/search/index' });
const goToDishDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
</script>
