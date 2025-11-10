<template>
  <view class="news-item-card" @click="goToDetail(news.id)">
    <view class="title">{{ news.title }}</view>
    <view class="summary">{{ news.summary || news.content }}</view>
    <view class="meta">
      <!-- 只有当有值时才显示，避免 '全校公告 / ' 的情况 -->
      <text v-if="news.canteenName" class="canteen-name">{{ news.canteenName }}</text>
      <text class="published-at">{{ news.publishedAt ? formatTime(news.publishedAt) : '' }}</text>
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
      url: `/pages/news/detail?id=${id}`,
    });
  }
};
</script>

<style scoped lang="scss">

.news-item-card {
  /* 模拟 prototype .card 样式 */
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); 
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
}

.title {
  /* 模拟 prototype font-weight:600 */
  font-weight: 600; 
  font-size: 16px;
  color: #333;
}

.summary {
  /* 模拟 prototype color:#666; margin-top:6px; */
  color: #666; 
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.4;
  /* 文本截断，UniApp中需要使用特定的CSS或标签 */
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2; // 限制最多显示2行
  -webkit-box-orient: vertical;
}

.meta {
  /* 模拟 prototype color:#999; font-size:12px; margin-top:8px; */
  margin-top: 8px; 
  font-size: 12px; 
  color: #999; 
  display: flex;
  justify-content: space-between;
}

.canteen-name {
  margin-right: 8px;
}
</style>