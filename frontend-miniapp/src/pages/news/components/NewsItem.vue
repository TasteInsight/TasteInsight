<template>
  <view 
    class="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm active:bg-gray-50 transition-all duration-200 cursor-pointer" 
    @click="goToDetail(news.id)"
  >
    <!-- 头部：标题 -->
    <view class="mb-2">
      <text class="text-base font-bold text-gray-900 leading-snug line-clamp-2">{{ news.title }}</text>
    </view>

    <!-- 中部：摘要 -->
    <view class="mb-3">
      <text class="text-gray-500 text-sm leading-relaxed line-clamp-2 text-justify">
        {{ news.summary || stripHtml(news.content) }}
      </text>
    </view>

    <!-- 底部：标签和时间 -->
    <view class="flex justify-between items-center">
      <!-- 左侧标签 -->
      <view 
        class="px-2 py-1 rounded-md text-xs font-medium"
        :class="news.canteenName ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'"
      >
        {{ news.canteenName || '全校公告' }}
      </view>
      
      <!-- 右侧时间 -->
      <view class="text-gray-400 text-xs flex items-center">
        <text>{{ news.publishedAt ? formatTime(news.publishedAt) : '' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 假设 dayjs 插件可用，提供一个格式化函数
import dayjs from 'dayjs'; // 假设 dayjs 已通过插件配置全局导入或此处引入
import type { News } from '@/types/api';

interface Props {
  news: News;
}

const props = defineProps<Props>();

const formatTime = (time: string): string => {
  // 仅保留日期部分，例如 2025-10-21
  return dayjs(time).format('YYYY-MM-DD');
};

// 简单的去除 HTML 标签函数，用于摘要回退
const stripHtml = (html: string): string => {
  if (!html) return '';
  const stripped = html.replace(/<[^>]*>/g, '');
  return stripped.substring(0, 60) + (stripped.length > 60 ? '...' : '');
};

const goToDetail = (id: string): void => {
  if (id) {
    uni.navigateTo({
      url: `/pages/news/components/detail?id=${id}`,
    });
  }
};
</script>

<style scoped>
/* 移除原有SCSS样式，使用Tailwind CSS */
view {
  box-sizing: border-box;
}
</style>