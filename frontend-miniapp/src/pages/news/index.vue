<template>
  <view class="min-h-screen w-full flex flex-col bg-gray-100 overflow-hidden">
    <!-- 导航栏区域（在uni-app中通常由pages.json配置，或者使用自定义组件） -->

    <!-- 骨架屏 -->
    <NewsListSkeleton v-if="loading && list.length === 0 && !isRefreshing" />

    <!-- 列表内容区域，使用页面自身的滚动 -->
    <view v-else class="flex-1 px-4 box-border pb-6">
      <view class="text-lg font-semibold text-gray-800 my-4">最新公告</view>

      <!-- 数据列表 -->
      <view v-if="list.length > 0">
        <NewsItem v-for="item in list" :key="item.id" :news="item" />
        
        <!-- 加载状态提示 -->
        <view class="text-center py-4 text-gray-500 text-sm">
          <text v-if="loading && list.length > 0">加载中...</text>
          <text v-else-if="finished">没有更多内容了</text>
        </view>
      </view>
      
      <!-- 首次加载中/空状态 -->
      <view v-else class="text-center py-4 text-gray-500 text-sm">
        <view v-if="!loading && !isRefreshing">
          <!-- 假设使用 EmptyState 组件 -->
          <!-- <EmptyState message="暂无最新公告" /> -->
          <text>暂无最新公告</text>
        </view>
      </view>

    </view>
    
    <!-- 底部导航区（在pages.json中配置为tabBar，此处不需重复实现 nav-bar） -->
  </view>
</template>

<script setup lang="ts">
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { useNewsList } from './composables/use-news-list';
import NewsItem from './components/NewsItem.vue';
import { NewsListSkeleton } from '@/components/skeleton';

const { list, loading, finished, isRefreshing, refresh, loadMore: loadMoreData } = useNewsList();

const loadMore = () => {
  if (!loading.value && !finished.value) {
    loadMoreData();
  }
};

const onRefresh = async () => {
  // isRefreshing 已经在 useNewsList 中处理，这里只调用 refresh
  await refresh();
  uni.stopPullDownRefresh();
};

onReachBottom(loadMore);

onPullDownRefresh(onRefresh);
</script>

<style scoped>
/* 移除原有SCSS样式，使用Tailwind CSS */
scroll-view {
  width: 100%;
  box-sizing: border-box;
}

view {
  box-sizing: border-box;
}
</style>