<template>
  <view class="bg-white rounded-xl shadow-md p-4 mb-3 cursor-pointer" @click="goToDetail(news.id)">
    <view class="font-semibold text-base text-gray-800 break-words">{{ news.title }}</view>
    <view class="text-gray-600 mt-1.5 text-sm leading-relaxed line-clamp-2 break-words">{{ news.summary || news.content }}</view>
    <view class="flex justify-between items-center mt-2 text-xs text-gray-500 flex-wrap">
      <!-- 只有当有值时才显示，避免 '全校公告 / ' 的情况 -->
      <text v-if="news.canteenName" class="mr-2 flex-shrink-0">{{ news.canteenName }}</text>
      <text class="flex-shrink-0">{{ news.publishedAt ? formatTime(news.publishedAt) : '' }}</text>
    </view>
  </view>
</template>

<script setup>
import { defineProps } from 'vue';
// 假设 dayjs 插件可用，提供一个格式化函数
import dayjs from 'dayjs'; // 假设 dayjs 已通过插件配置全局导入或此处引入

const props = defineProps({
  news: {
    type: Object,
    required: true,
  },
});

const formatTime = (time) => {
  // 仅保留日期部分，例如 2025-10-21
  return dayjs(time).format('YYYY-MM-DD');
};

const goToDetail = (id) => {
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
  max-width: 100%;
  box-sizing: border-box;
}

/* 确保文本换行 */
.break-words {
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}
</style>