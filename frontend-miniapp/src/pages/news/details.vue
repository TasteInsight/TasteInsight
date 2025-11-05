<template>
  <view class="news-detail-page">
    <!-- 顶部导航栏，假设使用了 CustomNavbar 组件 -->
    <!-- <CustomNavbar :title="newsDetail.title || '新闻详情'" :show-back="true" /> -->
    
    <scroll-view scroll-y class="detail-container">
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>

      <view v-else-if="newsDetail.id" class="detail-content">
        <h1 class="title">{{ newsDetail.title }}</h1>
        <view class="meta-info">
          <text class="canteen-name">{{ newsDetail.canteenName || '全校公告' }}</text>
          <text class="published-at">{{ newsDetail.publishedAt ? formatTime(newsDetail.publishedAt) : '' }}</text>
        </view>
        <view class="content">
          <!-- 这里使用 uni-rich-text 处理富文本内容，如果 content 可能是 HTML -->
          <rich-text :nodes="newsDetail.content"></rich-text>
        </view>
        <view class="footer">
          <text>发布人：{{ newsDetail.createdBy || '管理员' }}</text>
        </view>
      </view>

      <view v-else class="empty-state">
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

<style scoped lang="scss">
.news-detail-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.detail-container {
  flex: 1;
  background: white;
  padding: 16px;
}

.detail-content {
  padding-bottom: 20px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
  line-height: 1.4;
  /* UniApp 需注意 h1 标签兼容性，可能需要用 view/text 模拟 */
}

.meta-info {
  display: flex;
  justify-content: space-between;
  color: #999;
  font-size: 13px;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.content {
  font-size: 16px;
  line-height: 1.6;
  color: #333;
}

.footer {
  margin-top: 30px;
  padding-top: 10px;
  border-top: 1px dashed #eee;
  color: #999;
  font-size: 12px;
  text-align: right;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 50px 0;
  color: #999;
}
</style>