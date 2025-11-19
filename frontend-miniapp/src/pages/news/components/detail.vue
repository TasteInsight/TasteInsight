<template>
  <view class="min-h-screen flex flex-col bg-gray-100">
    <!-- 顶部导航栏，假设使用了 CustomNavbar 组件 -->
    <!-- <CustomNavbar :title="newsDetail.title || '新闻详情'" :show-back="true" /> -->
    
    <scroll-view scroll-y class="flex-1 bg-white p-4">
      <view v-if="loading" class="text-center py-12.5 text-gray-500">
        <text>加载中...</text>
      </view>

      <view v-else-if="newsDetail.id" class="pb-5">
        <view class="text-2xl font-bold mb-2.5 leading-relaxed">{{ newsDetail.title }}</view>
        <view class="flex justify-between text-gray-500 text-sm mb-5 pb-2.5 border-b border-gray-200">
          <text>{{ newsDetail.canteenName || '全校公告' }}</text>
          <text>{{ newsDetail.publishedAt ? formatTime(newsDetail.publishedAt) : '' }}</text>
        </view>
        <view class="text-base leading-relaxed text-gray-800">
          <!-- 这里使用 uni-rich-text 处理富文本内容，如果 content 可能是 HTML -->
          <rich-text :nodes="newsDetail.content"></rich-text>
        </view>
        <view class="mt-7.5 pt-2.5 border-t border-dashed border-gray-200 text-gray-500 text-xs text-right">
          <text>发布人：{{ newsDetail.createdBy || '管理员' }}</text>
        </view>
      </view>

      <view v-else class="text-center py-12.5 text-gray-500">
        <text>新闻内容加载失败或不存在</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getNewsById } from '@/api/modules/news';
// import CustomNavbar from '@/components/common/CustomNavbar.vue'; 
import dayjs from 'dayjs'; // 假设 dayjs 可用

const newsDetail = ref({});
const loading = ref(false);

onLoad((options) => {
  if (options.id) {
    fetchNewsDetail(options.id);
  } else {
    // 提示ID缺失，或跳转回列表
    uni.showToast({ title: '参数错误', icon: 'none' });
  }
});

const fetchNewsDetail = async (id) => {
  loading.value = true;
  try {
    const res = await getNewsById(id);
    if (res.code === 200 && res.data) {
      newsDetail.value = res.data;
    } else {
      uni.showToast({ title: '加载失败', icon: 'error' });
    }
  } catch (error) {
    uni.showToast({ title: '网络错误', icon: 'error' });
  } finally {
    loading.value = false;
  }
};

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm');
};
</script>

<style scoped>
/* 移除原有SCSS样式，使用Tailwind CSS */
</style>