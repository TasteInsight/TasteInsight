<template>
  <view class="page-content page-state-layout"
    ><NewsFeed ref="feed" class="page-state-content"
  /></view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import NewsFeed from './components/NewsFeed.vue';
const feed = ref<{ refresh: () => unknown; loadMore: () => unknown } | null>(null);
onReachBottom(() => {
  void feed.value?.loadMore();
});
onPullDownRefresh(async () => {
  try {
    await feed.value?.refresh();
  } finally {
    uni.stopPullDownRefresh();
  }
});
</script>
