<template>
  <view class="skeleton-page" role="status" aria-label="正在加载首页">
    <SkeletonBase height="44px" rounded="rounded-full" />
    <view class="index-skeleton-canteens">
      <view v-for="i in 3" :key="i" class="index-skeleton-canteen">
        <SkeletonBase width="116px" height="78px" rounded="rounded-lg" />
        <SkeletonBase width="84px" height="14px" />
      </view>
    </view>
    <SkeletonBase width="90px" height="20px" />
    <view class="skeleton-inline skeleton-filter-row"><SkeletonBase v-for="i in 3" :key="i" width="76px" height="36px" rounded="rounded-full" /></view>
    <DishListSkeleton />
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
import DishListSkeleton from './DishListSkeleton.vue';
</script>
