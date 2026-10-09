<template>
  <view class="page-content news-page">
    <view class="news-content">
      <NewsItem v-for="item in list" :key="item.id" :news="item" />
      <view v-if="error" class="news-state" role="status">
        <text>{{ error }}</text>
        <button class="news-retry" :disabled="loading" @click="retry">重试</button>
      </view>
      <view v-else-if="initialized && !list.length" class="news-state">暂无公告</view>
      <view v-else-if="loading && list.length" class="news-state" role="status">加载中…</view>
      <button v-else-if="list.length && !finished" class="news-retry news-more" @click="loadMore">
        加载更多
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { useNewsList } from './composables/use-news-list';
import NewsItem from './components/NewsItem.vue';
const {
  list,
  loading,
  initialized,
  finished,
  error,
  retry,
  refresh,
  loadMore: loadMoreData,
} = useNewsList();

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
.news-content { box-sizing:border-box; width:100%; max-width:760px; margin:0 auto; padding:0 20px 24px; }
.news-state { display:flex; flex-direction:column; align-items:center; gap:12px; padding:32px 16px; color:#667085; font-size:14px; line-height:1.6; text-align:center; }
.news-retry { min-height:44px; margin:0; padding:8px 20px; border:0; border-radius:10px; background:#f4f4f5; color:#660874; font-size:14px; line-height:28px; }
.news-retry::after { border:0; }
.news-more { margin:20px auto 0; }
.news-retry:focus-visible { outline:2px solid #660874; outline-offset:2px; }
</style>
