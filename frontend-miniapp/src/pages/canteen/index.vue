<template>
  <view class="min-h-screen bg-white">
    <!-- 骨架屏 -->
    <CanteenSkeleton v-if="isInitialLoading" />
    
    <template v-else>
      <!-- 搜索栏 -->
      <view class="px-4">
        <CanteenSearchBar />
      </view>

      <CanteenHeader :canteen="canteenInfo" />
      
      <!-- 窗口列表 -->
      <CanteenWindowList :windows="windows" @click="goToWindow" />

      <view class="px-4">
        <CanteenFilterBar @filter-change="handleFilterChange" />
      </view>

      <view class="px-4">
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

          <!-- 上拉加载更多：底部提示/动画 -->
          <view class="flex items-center justify-center py-4 text-gray-500 text-sm">
            <template v-if="dishesLoadingMore">
              <view class="w-4 h-4 mr-2 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin"></view>
              <text>加载中...</text>
            </template>
            <template v-else-if="hasMore">
              <text>上拉加载更多</text>
            </template>
            <template v-else>
              <text>没有更多了</text>
            </template>
          </view>
        </view>

        <view v-else class="text-center py-10 text-gray-500">
          暂无菜品信息
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { useCanteenData } from './composables/use-canteen-data';
import CanteenSearchBar from './components/CanteenSearchBar.vue';
import CanteenFilterBar from './components/CanteenFilterBar.vue';
import CanteenHeader from './components/CanteenHeader.vue';
import CanteenDishCard from './components/CanteenDishCard.vue';
import CanteenWindowList from './components/CanteenWindowList.vue';
import { CanteenSkeleton } from '@/components/skeleton';
import type { GetDishesRequest } from '@/types/api';

const { canteenInfo, loading, error, windows, dishes, dishesLoadingMore, hasMore, init, fetchDishes, loadMoreDishes } = useCanteenData();

const currentCanteenId = ref('');
const currentFilter = ref<GetDishesRequest['filter']>({});
const isInitialLoading = ref(true);

// 页面加载时获取参数并初始化
onLoad(async (options: any) => {
  if (options.id) {
    currentCanteenId.value = options.id;
    try {
      await init(options.id);
    } finally {
      isInitialLoading.value = false;
    }
  } else {
    isInitialLoading.value = false;
  }
});

// 下拉刷新处理
onPullDownRefresh(async () => {
  try {
    if (currentCanteenId.value) {
      await init(currentCanteenId.value);
      // 如果有筛选条件，重新应用
      if (Object.keys(currentFilter.value).length > 0) {
        await fetchDishes(currentCanteenId.value, currentFilter.value);
      }
    }
    uni.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1500
    });
  } catch (err) {
    console.error('下拉刷新失败:', err);
    uni.showToast({
      title: '刷新失败',
      icon: 'none'
    });
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

// 触底上拉加载更多
onReachBottom(async () => {
  await loadMoreDishes();
});
</script>
