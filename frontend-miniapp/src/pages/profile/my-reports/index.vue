<template>
  <view class="reports-page page-content page-state-layout" :aria-busy="loading">
    <EmptyState
      v-if="!user.isLoggedIn"
      class="page-state-region"
      title="登录后查看举报记录"
      icon="shield"
      action-text="登录"
      @action="login"
    />
    <template v-else>
      <ReviewListSkeleton v-if="loading && !initialized" />
      <view v-if="focusId" class="report-focus">
        <text class="report-section-title">举报详情</text>
        <ReportRecord v-if="focusedReport" :item="focusedReport" />
        <view v-if="focusError" class="error-feedback" role="alert">
          <text class="error-feedback__message">{{ focusError }}</text>
          <button class="error-feedback__action" :disabled="loading" @click="refresh">重试</button>
        </view>
      </view>
      <text v-if="focusId && visibleItems.length" class="report-section-title">举报记录</text>
      <ReportRecord v-for="item in visibleItems" :key="item.id" :item="item" />
      <view v-if="error" class="error-feedback" role="alert">
        <text class="error-feedback__message">{{ error }}</text>
        <button class="error-feedback__action" :disabled="loading" @click="retry">重新加载</button>
      </view>
      <EmptyState
        v-if="initialized && !items.length && !focusedReport && !error && !focusError"
        class="page-state-region"
        title="暂无举报记录"
        icon="shield"
      />
      <button v-if="hasMore && !error" class="reports-more" :disabled="loading" @click="loadMore">
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
    </template>
  </view>
</template>
<script setup lang="ts">
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import EmptyState from '@/components/EmptyState.vue';
import ReviewListSkeleton from '@/components/skeleton/ReviewListSkeleton.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { openLogin } from '@/utils/login-navigation';
import ReportRecord from './ReportRecord.vue';
import { useMyReports } from './use-my-reports';
const user = useUserStore();
const {
  items,
  visibleItems,
  focusId,
  focusedReport,
  focusError,
  error,
  loading,
  initialized,
  hasMore,
  refresh,
  retry,
  loadMore,
} = useMyReports();
onLoad(options => {
  focusId.value = options?.id || '';
});
onShow(refresh);
onReachBottom(loadMore);
onPullDownRefresh(async () => {
  try {
    await refresh();
  } finally {
    uni.stopPullDownRefresh();
  }
});
const login = () => openLogin();
</script>
<style scoped>
.reports-page {
  padding: 16px 24px 40px;
}
.report-focus {
  margin-bottom: 24px;
}
.report-section-title {
  display: block;
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
  margin-top: 8px;
}
.reports-more {
  margin: 24px auto 0;
  width: fit-content;
  padding: 0 20px;
  color: #660874;
  background: #fff;
  font-size: 14px;
}
.reports-more[disabled] {
  opacity: 0.6;
}
@media (max-width: 360px) {
  .reports-page {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
