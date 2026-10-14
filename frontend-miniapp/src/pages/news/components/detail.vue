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

      <view v-if="error || notFound" class="article-state error-feedback" role="alert">
        <text class="error-feedback__message">{{ notFound ? '公告不存在或已下架' : error }}</text>
        <button
          v-if="!notFound"
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          :disabled="loading"
          @click="retry"
        >
          重试
        </button>
        <button
          v-else
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="backToNews"
        >
          返回公告列表
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import config from '@/config';
import { openCampus } from '@/utils/campus-navigation';
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
const backToNews = () => {
  if (config.platform === 'mp-weixin') uni.switchTab({ url: '/pages/news/index' });
  else openCampus('news');
};

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
</style>
