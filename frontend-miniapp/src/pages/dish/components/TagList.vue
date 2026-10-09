<template>
  <view class="dish-list-page page-content">
    <view class="dish-list-heading">
      <text class="dish-list-title">#{{ currentTag }}</text>
      <text class="dish-list-caption">{{
        canteenName ? canteenName + ' · 相关菜品' : '相关菜品'
      }}</text>
    </view>
    <view class="dish-list-content" :aria-busy="loading">
      <view v-if="loading && dishes.length" class="dish-list-footer">正在更新菜品…</view>
      <view v-if="error" class="dish-list-state">
        <text>{{ error }}</text>
        <button class="dish-list-action" @click="loadDishes(!errorIsAppend)">重新加载</button>
      </view>
      <view v-if="dishes.length > 0">
        <CanteenDishCard
          v-for="dish in dishes"
          :key="dish.id"
          :dish="dish"
          @click="goToDishDetail"
        />
        <view v-if="loadingMore" class="dish-list-footer">加载更多…</view>
        <view v-else-if="!loading && !error" class="dish-list-footer">
          <button v-if="hasMore" class="dish-list-action" @click="loadDishes()">加载更多</button>
          <text v-else>没有更多了</text>
        </view>
      </view>
      <view v-else-if="initialized && !loading && !error" class="dish-list-state">
        <text>暂无相关菜品</text>
        <text class="dish-list-hint">可以返回食堂，查看其他标签的菜品。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onScopeDispose } from 'vue';
import { onLoad, onReachBottom, onShow } from '@dcloudio/uni-app';
import { getDishes } from '@/api/modules/dish';
import type { Dish } from '@/types/api';
import { useUserStore } from '@/store/modules/use-user-store';
import { getPreferredDishSort } from '@/utils/dish-sort';
import CanteenDishCard from '@/pages/canteen/components/CanteenDishCard.vue';

const currentTag = ref('');
const canteenId = ref('');
const canteenName = ref('');
const dishes = ref<Dish[]>([]);
const initialized = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const errorIsAppend = ref(false);
const page = ref(1);
const pageSize = ref(10);
const hasMore = ref(true);
const userStore = useUserStore();
const preferredSort = () =>
  getPreferredDishSort(userStore.userInfo?.settings?.displaySettings?.sortBy);
let querySort = preferredSort();
let requestVersion = 0;
let disposed = false;
onScopeDispose(() => {
  disposed = true;
  requestVersion += 1;
});

onLoad((options: any) => {
  if (options.tag && options.canteenId) {
    const tag = decodeURIComponent(options.tag);
    if (currentTag.value !== tag || canteenId.value !== options.canteenId) {
      dishes.value = [];
      initialized.value = false;
      page.value = 1;
      hasMore.value = true;
    }
    currentTag.value = tag;
    canteenId.value = options.canteenId;
    canteenName.value = decodeURIComponent(options.canteenName || '');

    uni.setNavigationBarTitle({
      title: '标签菜品',
    });

    loadDishes(true);
  }
});

const loadDishes = async (refresh = false) => {
  if (!refresh && (loading.value || loadingMore.value)) return;
  if (!refresh && !initialized.value) return;
  if (!refresh && !hasMore.value) return;
  if (!refresh && error.value && !errorIsAppend.value) return;

  const request = ++requestVersion;
  const session = userStore.sessionVersion;
  const ownsQuery = () =>
    !disposed && request === requestVersion && session === userStore.sessionVersion;
  loading.value = refresh;
  loadingMore.value = !refresh;
  error.value = '';
  errorIsAppend.value = !refresh;

  if (refresh) querySort = preferredSort();
  const requestedPage = refresh ? 1 : page.value + 1;

  try {
    const res = await getDishes({
      filter: {
        tag: [currentTag.value],
        canteenId: [canteenId.value],
        includeOffline: false,
      },
      search: {
        keyword: '',
      },
      sort: { ...querySort },
      pagination: {
        page: requestedPage,
        pageSize: pageSize.value,
      },
    });

    if (!ownsQuery()) return;
    if (res.code === 200 && res.data) {
      const newDishes = res.data.items || [];
      if (refresh) {
        dishes.value = newDishes;
      } else {
        dishes.value = [...dishes.value, ...newDishes];
      }

      page.value = res.data.meta.page ?? requestedPage;
      hasMore.value = page.value < res.data.meta.totalPages;
      initialized.value = true;
    } else {
      error.value = res.message || '加载失败';
    }
  } catch (err) {
    if (!ownsQuery()) return;
    error.value = '网络错误，请稍后重试';
    console.error(err);
  } finally {
    if (ownsQuery()) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
};

onReachBottom(() => {
  if (!error.value) loadDishes();
});

onShow(() => {
  if (canteenId.value && JSON.stringify(preferredSort()) !== JSON.stringify(querySort))
    loadDishes(true);
});
watch(
  () => userStore.sessionVersion,
  () => {
    requestVersion += 1;
    dishes.value = [];
    initialized.value = false;
    loading.value = false;
    loadingMore.value = false;
    error.value = '';
  },
  { flush: 'sync' }
);

const goToDishDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
};
</script>

<style scoped src="@/styles/dish-list-page.css"></style>
