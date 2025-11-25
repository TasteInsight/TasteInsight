<template>
  <view class="min-h-screen bg-white">
    <!-- 搜索栏 -->
    <view class="px-4 pt-4">
      <view 
        class="bg-gray-50 rounded-2xl h-12 border border-gray-200 flex items-center px-4 cursor-pointer"
        @tap="goToSearch"
      >
        <text style="color:#999; margin-right:8px; font-size: 20px;">🔍</text>
        <text class="text-gray-500 text-sm">搜索食堂或菜品</text>
      </view>
    </view>

    <CanteenHeader :canteen="canteenInfo" />
    
    <!-- 窗口列表 -->
    <CanteenWindowList :windows="windows" @click="goToWindow" />

    

    <CanteenFilterBar :filters="filters" :activeFilter="activeFilter" @toggle="handleToggle" />

    <view class="px-4">
      <view v-if="loading" class="text-center py-8 text-gray-500">
        加载中...
      </view>

      <view v-else-if="error" class="text-center py-8 text-red-500">
        {{ error }}
      </view>

      <view v-else-if="dishes.length > 0">
        <CanteenDishCard
          v-for="dish in dishes"
          :key="dish.id"
          :dish="dish"
          @click="goToDishDetail"
        />
      </view>

      <view v-else class="text-center py-10 text-gray-500">
        暂无菜品信息
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { useCanteenData } from './composables/use-canteen-data';
import CanteenHeader from './components/CanteenHeader.vue';
import CanteenFilterBar from './components/CanteenFilterBar.vue';
import CanteenDishCard from './components/CanteenDishCard.vue';
import CanteenWindowList from './components/CanteenWindowList.vue';

const { canteenInfo, loading, error, windows, dishes, filters, activeFilter, init, toggleFilter } = useCanteenData();

// 页面加载时获取参数并初始化
onLoad((options: any) => {
  if (options.id) {
    init(options.id);
  }
});

const goToSearch = () => uni.navigateTo({ url: '/pages/search/index' });
const goToDishDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
const goToWindow = (id: string) => uni.navigateTo({ url: `/pages/window/index?id=${id}` });

const handleToggle = (key: string) => {
  toggleFilter(key);
  uni.showToast({ title: '筛选功能开发中', icon: 'none' });
};
</script>