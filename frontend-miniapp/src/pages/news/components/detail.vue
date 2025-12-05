<template>
  <view class="min-h-screen flex flex-col bg-gray-100">
    <!-- 骨架屏 -->
    <NewsDetailSkeleton v-if="loading" />
    
    <scroll-view v-else scroll-y class="flex-1 bg-white">
      <view class="p-4 box-border w-full">
        <view v-if="newsDetail.id" class="pb-5">
          <view class="text-2xl font-bold mb-2.5 leading-relaxed">{{ newsDetail.title }}</view>
          <view class="flex justify-between text-gray-500 text-sm mb-5 pb-2.5 border-b border-gray-200">
            <text>{{ newsDetail.canteenName || '全校公告' }}</text>
            <text>{{ newsDetail.publishedAt ? formatTime(newsDetail.publishedAt) : '' }}</text>
          </view>
          <view class="text-base leading-relaxed text-gray-800 overflow-hidden break-words w-full">
            <!-- 使用处理后的富文本内容，支持图片自适应 -->
            <rich-text :nodes="formattedContent"></rich-text>
          </view>
          <view class="mt-6 pt-2 border-t border-dashed border-gray-200 text-gray-500 text-xs text-right">
            <text>发布人：{{ newsDetail.createdBy || '管理员' }}</text>
          </view>
        </view>

        <view v-else class="text-center py-12.5 text-gray-500">
          <text>新闻内容加载失败或不存在</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { useNewsDetail } from '../composables/use-news-detail';
import { NewsDetailSkeleton } from '@/components/skeleton';

const { newsDetail, loading, formattedContent, formatTime, initDetailPage } = useNewsDetail();

// 初始化详情页
initDetailPage();
</script>

