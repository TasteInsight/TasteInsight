<template>
  <view class="min-h-screen bg-white">
    <!-- 骨架屏：首次加载时显示 -->
    <TagListSkeleton v-if="loading && dishes.length === 0" />

    <template v-else>
    <!-- 顶部标题 -->
    <view class="px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
      <view class="text-lg font-bold text-gray-800">
        #{{ currentTag }}
      </view>
      <view class="text-xs text-gray-500 mt-1">
        {{ canteenName }} · 相关菜品
      </view>
    </view>

    <view class="px-4">
      <view v-if="error" class="text-center py-8 text-red-500">
        {{ error }}
        <view class="mt-2">
          <button size="mini" @click="loadDishes(true)">重试</button>
        </view>
      </view>

      <view v-else-if="dishes.length > 0">
        <CanteenDishCard
          v-for="dish in dishes"
          :key="dish.id"
          :dish="dish"
          @click="goToDishDetail"
        />
        <view v-if="loading" class="text-center py-4 text-gray-400 text-sm">
          加载更多...
        </view>
        <view v-if="!hasMore && dishes.length > 0" class="text-center py-4 text-gray-400 text-sm">
          没有更多了
        </view>
      </view>

      <view v-else class="text-center py-10 text-gray-500">
        暂无相关菜品
      </view>
    </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onReachBottom } from '@dcloudio/uni-app';
import { getDishes } from '@/api/modules/dish';
import type { Dish } from '@/types/api';
import CanteenDishCard from '@/pages/canteen/components/CanteenDishCard.vue';
import { TagListSkeleton } from '@/components/skeleton';

const currentTag = ref('');
const canteenId = ref('');
const canteenName = ref('');
const dishes = ref<Dish[]>([]);
const loading = ref(false);
const error = ref('');
const page = ref(1);
const pageSize = ref(10);
const hasMore = ref(true);

onLoad((options: any) => {
  if (options.tag && options.canteenId) {
    currentTag.value = decodeURIComponent(options.tag);
    canteenId.value = options.canteenId;
    canteenName.value = decodeURIComponent(options.canteenName || '');
    
    uni.setNavigationBarTitle({
      title: `#${currentTag.value} - ${canteenName.value}`
    });

    loadDishes(true);
  }
});

const loadDishes = async (refresh = false) => {
  if (loading.value) return;
  if (!refresh && !hasMore.value) return;

  loading.value = true;
  error.value = '';

  if (refresh) {
    page.value = 1;
    dishes.value = [];
    hasMore.value = true;
  }

  try {
    const res = await getDishes({
      filter: {
        tag: [currentTag.value],
        canteenId: [canteenId.value],
        includeOffline: false
      },
      search: {
        keyword: ''
      },
      sort: {
        field: 'createdAt',
        order: 'desc'
      },
      pagination: {
        page: page.value,
        pageSize: pageSize.value
      }
    });

    if (res.code === 200 && res.data) {
      const newDishes = res.data.items || [];
      if (refresh) {
        dishes.value = newDishes;
      } else {
        dishes.value = [...dishes.value, ...newDishes];
      }
      
      if (newDishes.length < pageSize.value) {
        hasMore.value = false;
      } else {
        page.value++;
      }
    } else {
      error.value = res.message || '加载失败';
    }
  } catch (err) {
    error.value = '网络错误，请稍后重试';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onReachBottom(() => {
  loadDishes();
});

const goToDishDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
};
</script>
