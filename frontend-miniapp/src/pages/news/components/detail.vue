<template>
  <view class="min-h-screen flex flex-col bg-gray-100">
    
    
    <scroll-view scroll-y class="flex-1 bg-white">
      <view class="p-4 box-border w-full">
        <view v-if="loading" class="text-center py-12.5 text-gray-500">
          <text>加载中...</text>
        </view>

        <view v-else-if="newsDetail.id" class="pb-5">
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
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getNewsById } from '@/api/modules/news';
// import CustomNavbar from '@/components/common/CustomNavbar.vue'; 
import dayjs from 'dayjs'; 
import type { News } from '@/types/api';

const newsDetail = ref<News>({} as News);
const loading = ref<boolean>(false);

// 处理富文本内容，主要是为了让图片自适应屏幕宽度
const formattedContent = computed((): string => {
  if (!newsDetail.value.content) return '';
  
  let content: string = newsDetail.value.content;

  // 0. 移除 html 和 body 标签，防止 rich-text 解析异常
  content = content.replace(/<\/?html[^>]*>/gi, '').replace(/<\/?body[^>]*>/gi, '');
  
  // 1. 给 img 标签添加 max-width: 100% 样式
  // 使用回调函数处理，避免产生重复的 style 属性
  content = content.replace(/<img[^>]*>/gi, (match: string) => {
    // 如果已经有 style 属性
    if (match.indexOf('style="') > -1) {
      return match.replace('style="', 'style="max-width:100%;height:auto;display:block;margin:10px auto;');
    }
    // 如果没有 style 属性
    return match.replace('<img', '<img style="max-width:100%;height:auto;display:block;margin:10px auto;"');
  });

  // 2. 给 table 添加 max-width: 100%
  content = content.replace(/<table[^>]*>/gi, (match: string) => {
    if (match.indexOf('style="') > -1) {
      return match.replace('style="', 'style="max-width:100%;box-sizing:border-box;');
    }
    return match.replace('<table', '<table style="max-width:100%;box-sizing:border-box;"');
  });

  // 3. 给 pre 添加样式防止溢出
  content = content.replace(/<pre[^>]*>/gi, (match: string) => {
    if (match.indexOf('style="') > -1) {
      return match.replace('style="', 'style="max-width:100%;white-space:pre-wrap;word-break:break-all;');
    }
    return match.replace('<pre', '<pre style="max-width:100%;white-space:pre-wrap;word-break:break-all;"');
  });
  
  return content;
});

const formatTime = (time: string): string => {
  return dayjs(time).format('YYYY-MM-DD HH:mm');
};

onLoad((options: any) => {
  if (options.id) {
    fetchNewsDetail(options.id);
  } else {
    // 提示ID缺失，或跳转回列表
    uni.showToast({ title: '参数错误', icon: 'none' });
  }
});

const fetchNewsDetail = async (id: string): Promise<void> => {
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
</script>

