<template>
  <view class="news-page page-state-content">
    <view class="news-content page-state-content">
      <NewsItem v-for="item in list" :key="item.id" :news="item" />
      <view
        v-if="error"
        class="error-feedback"
        :class="{ 'page-state-region': !list.length }"
        role="alert"
      >
        <text class="error-feedback__message">{{ error }}</text>
        <button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          :disabled="loading"
          @click="retry"
        >
          重试
        </button>
      </view>
      <EmptyState
        class="page-state-region"
        v-else-if="initialized && !list.length"
        title="暂无公告"
        icon="info"
      />
      <EmptyState
        v-else-if="loading && !list.length"
        class="page-state-region"
        title="正在加载公告…"
        loading
      />
      <view v-else-if="loading && list.length" class="news-state" role="status">加载中…</view>
      <button v-else-if="list.length && !finished" class="news-retry news-more" @click="loadMore">
        加载更多
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useNewsList } from '../composables/use-news-list';
import NewsItem from './NewsItem.vue';
import EmptyState from '@/components/EmptyState.vue';
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
};

defineExpose({ refresh: onRefresh, loadMore, initialized, loading });
</script>

<style scoped>
.news-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 0 20px 24px;
}
.news-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 16px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
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
