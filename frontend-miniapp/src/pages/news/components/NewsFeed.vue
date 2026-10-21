<template>
  <view class="news-page page-state-content">
    <view class="news-content page-state-content">
      <NewsItem v-for="item in list" :key="item.id" :news="item" />
      <AsyncState
        :loading="loading"
        :initialized="initialized"
        :has-content="!!list.length"
        :error="error"
        loading-title="正在加载新闻…"
        empty-title="暂无新闻"
        empty-icon="info"
        @retry="retry"
      />
      <button
        v-if="list.length && !finished && !loading && !error"
        class="news-retry news-more"
        @click="loadMore"
      >
        加载更多
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useNewsList } from '../composables/use-news-list';
import NewsItem from './NewsItem.vue';
import AsyncState from '@/components/AsyncState.vue';
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });
const {
  list,
  loading,
  initialized,
  needsInitialLoad,
  finished,
  error,
  retry,
  refresh,
  loadMore: loadMoreData,
} = useNewsList({}, () => props.active);

const loadMore = () => {
  if (!loading.value && !finished.value) {
    loadMoreData();
  }
};

const onRefresh = async () => {
  // isRefreshing 已经在 useNewsList 中处理，这里只调用 refresh
  await refresh();
};

defineExpose({ refresh: onRefresh, loadMore, initialized, loading, needsInitialLoad });
</script>

<style scoped>
.news-content {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--page-content-width);
  margin: 0 auto;
  padding: 0 20px 24px;
}
.news-retry {
  min-height: 44px;
  margin: 0;
  padding: 8px 20px;
  border: 0;
  border-radius: 10px;
  background: #f4f4f5;
  color: #660874;
  font-size: 14px;
  line-height: 28px;
}
.news-retry::after {
  border: 0;
}
.news-more {
  margin: 20px auto 0;
}
.news-retry:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
