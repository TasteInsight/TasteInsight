<template>
  <view class="min-h-screen bg-white">
    <!-- 骨架屏 -->
    <WindowSkeleton v-if="isInitialLoading" />
    
    <template v-else>
      <!-- 搜索栏 -->
      <view class="px-4">
        <CanteenSearchBar />
      </view>

      <!-- 窗口信息 -->
      <WindowHeader :window="windowInfo" />

      <!-- 菜品列表 -->
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
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useWindowData } from '@/pages/window/composables/use-window-data';
import WindowHeader from './components/WindowHeader.vue';
import CanteenSearchBar from '../canteen/components/CanteenSearchBar.vue';
import CanteenDishCard from '../canteen/components/CanteenDishCard.vue';
import { WindowSkeleton } from '@/components/skeleton';

const { windowInfo, loading, error, dishes, init } = useWindowData();

let currentWindowId = '';
const isInitialLoading = ref(true);

onLoad(async (options: any) => {
  if (options.id) {
    currentWindowId = options.id;
    try {
      await init(options.id);
    } finally {
      isInitialLoading.value = false;
    }
  } else {
    isInitialLoading.value = false;
  }
});

const goToSearch = () => uni.navigateTo({ url: '/pages/search/index' });
const goToDishDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
</script>
