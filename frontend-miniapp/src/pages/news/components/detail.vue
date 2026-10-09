<template>
  <view class="page-content news-detail">
    <view class="news-article">
      <view v-if="initialized && newsDetail.id">
        <view class="article-title">{{ newsDetail.title }}</view>
        <view class="article-meta">
          <text>{{ newsDetail.canteenName || '全校公告' }}</text>
          <text>{{ newsDetail.publishedAt ? formatTime(newsDetail.publishedAt) : '' }}</text>
        </view>
        <view class="article-body">
          <!-- 使用处理后的富文本内容，支持图片自适应 -->
          <rich-text :nodes="formattedContent"></rich-text>
        </view>
      </view>

      <view v-if="error || notFound" class="article-state" role="alert">
        <text>{{ notFound ? '公告不存在或已下架' : error }}</text>
        <button v-if="!notFound" class="article-action" :disabled="loading" @click="retry">
          重试
        </button>
        <button v-else class="article-action" @click="backToNews">返回公告列表</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useNewsDetail } from '../composables/use-news-detail';

const {
  newsDetail,
  loading,
  initialized,
  error,
  notFound,
  retry,
  formattedContent,
  formatTime,
  initDetailPage,
} = useNewsDetail();
const backToNews = () => uni.switchTab({ url: '/pages/news/index' });

// 初始化详情页
initDetailPage();
</script>
<style scoped>
.news-article {
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}
.article-title {
  color: #1f2937;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 14px 0 24px;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}
.article-body {
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  color: #1f2937;
  font-size: 16px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.article-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px 12px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}
.article-action {
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
.article-action::after {
  border: 0;
}
.article-action:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
