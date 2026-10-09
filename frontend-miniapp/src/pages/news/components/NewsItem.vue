<template>
  <button
    class="news-item"
    :aria-label="news.title"
    @click="goToDetail(news.id)"
    @keydown.space.prevent
    @keyup.enter="goToDetail(news.id)"
    @keyup.space="goToDetail(news.id)"
  >
    <!-- 头部：标题 -->
    <view class="news-title">
      <text>{{ news.title }}</text>
    </view>

    <!-- 中部：摘要 -->
    <view class="news-summary">
      <text>
        {{ getNewsSummary(news) }}
      </text>
    </view>

    <!-- 底部：标签和时间 -->
    <view class="news-meta">
      <!-- 左侧标签 -->
      <TagBadge :label="getNewsTagText(news)" />

      <!-- 右侧时间 -->
      <view class="news-time">
        <text>{{ news.publishedAt ? formatTime(news.publishedAt) : '' }}</text>
      </view>
    </view>
  </button>
</template>

<script setup lang="ts">
import type { News } from '@/types/api';
import { useNewsItem } from '../composables/use-news-item';
import TagBadge from '@/components/TagBadge.vue';

interface Props {
  news: News;
}

const props = defineProps<Props>();

const { formatTime, getNewsSummary, getNewsTagText, goToDetail } = useNewsItem();
</script>

<style scoped>
.news-item {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 22px 0;
  border: 0;
  border-bottom: 1px solid #eaecf0;
  border-radius: 0;
  background: #fff;
  color: #1f2937;
  text-align: left;
  white-space: normal;
}
.news-item::after {
  border: 0;
}
.news-title {
  font-size: 17px;
  line-height: 1.5;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.news-summary {
  margin-top: 8px;
  color: #667085;
  font-size: 14px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.news-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 12px;
}
.news-time {
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}
.news-item:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
