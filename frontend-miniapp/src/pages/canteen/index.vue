<template>
  <view class="min-h-screen bg-white">
    <!-- 搜索栏 -->
    <view class="px-4">
      <CanteenSearchBar />
    </view>

    <CanteenHeader :canteen="canteenInfo" />
    
    <!-- 窗口列表 -->
    <CanteenWindowList :windows="windows" @click="goToWindow" />

    <view class="px-4">
      <CanteenFilterBar @filter-change="handleFilterChange" />
    </view>

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
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useCanteenData } from './composables/use-canteen-data';
import CanteenSearchBar from './components/CanteenSearchBar.vue';
import CanteenFilterBar from './components/CanteenFilterBar.vue';
import CanteenHeader from './components/CanteenHeader.vue';
import CanteenDishCard from './components/CanteenDishCard.vue';
import CanteenWindowList from './components/CanteenWindowList.vue';
import type { GetDishesRequest } from '@/types/api';

const { canteenInfo, loading, error, windows, dishes, init, fetchDishes } = useCanteenData();

const currentCanteenId = ref('');

// 页面加载时获取参数并初始化
onLoad((options: any) => {
  if (options.id) {
    currentCanteenId.value = options.id;
    init(options.id);
  }
});

const goToDishDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
const goToWindow = (id: string) => uni.navigateTo({ url: `/pages/window/index?id=${id}` });

const handleFilterChange = (filter: GetDishesRequest['filter']) => {
  if (currentCanteenId.value) {
    fetchDishes(currentCanteenId.value, filter);
  }
};
</script>
