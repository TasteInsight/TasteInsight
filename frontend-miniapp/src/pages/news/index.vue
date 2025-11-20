<template>
  <view class="min-h-screen w-full flex flex-col bg-gray-100 overflow-hidden">
    <!-- 导航栏区域（在uni-app中通常由pages.json配置，或者使用自定义组件） -->
    <view class="h-14 flex items-center justify-center px-4 bg-white border-b border-gray-200">
      <text class="text-lg font-semibold text-gray-800">新闻</text>
    </view>

    <!-- 列表内容区域，使用 scroll-view 适配下拉刷新和触底加载 -->
    <scroll-view
      scroll-y
      class="flex-1 px-4 box-border"
      :refresher-enabled="true"
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
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
        <text v-if="loading">加载中...</text>
        <view v-else-if="!loading && !isRefreshing">
          <!-- 假设使用 EmptyState 组件 -->
          <!-- <EmptyState message="暂无最新公告" /> -->
          <text>暂无最新公告</text>
        </view>
      </view>

    </scroll-view>
    
    <!-- 底部导航区（在pages.json中配置为tabBar，此处不需重复实现 nav-bar） -->
  </view>
</template>

<script setup>
import { useNewsList } from './composables/use-news-list';
import NewsItem from './components/NewsItem.vue';

const { list, loading, finished, isRefreshing, refresh, loadMore: loadMoreData } = useNewsList();

const loadMore = () => {
  if (!loading.value && !finished.value) {
    loadMoreData();
  }
};

const onRefresh = async () => {
  // isRefreshing 已经在 useNewsList 中处理，这里只调用 refresh
  await refresh();
  // uni.stopPullDownRefresh(); // 如果在pages.json中启用了原生下拉，需要在原生事件中调用
};

// 如果在 pages.json 中未启用原生下拉刷新，可在这里监听生命周期
// import { onPullDownRefresh } from '@dcloudio/uni-app';
// onPullDownRefresh(async () => {
//   await onRefresh();
//   uni.stopPullDownRefresh();
// });
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