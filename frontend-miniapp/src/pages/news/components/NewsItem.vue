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
        {{ getNewsSummary(news) }}
      </text>
    </view>

    <!-- 底部：标签和时间 -->
    <view class="flex justify-between items-center">
      <!-- 左侧标签 -->
      <view
        class="px-2 py-1 rounded-md text-xs font-medium"
        :class="getNewsTagClass(news)"
      >
        {{ getNewsTagText(news) }}
      </view>

      <!-- 右侧时间 -->
      <view class="text-gray-400 text-xs flex items-center">
        <text>{{ news.publishedAt ? formatTime(news.publishedAt) : '' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { News } from '@/types/api';
import { useNewsItem } from '../composables/use-news-item';

interface Props {
  news: News;
}

const props = defineProps<Props>();

const { formatTime, getNewsSummary, getNewsTagText, getNewsTagClass, goToDetail } = useNewsItem();
</script>

<style scoped>
view {
  box-sizing: border-box;
}
</style>