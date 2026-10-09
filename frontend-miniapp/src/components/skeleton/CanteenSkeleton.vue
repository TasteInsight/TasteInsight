<template>
  <view class="skeleton-page" role="status" aria-label="正在加载食堂">
    <SkeletonBase height="44px" rounded="rounded-full" />
    <SkeletonBase height="180px" rounded="rounded-lg" />
    <view class="skeleton-copy"><SkeletonBase width="48%" height="24px" /><SkeletonBase width="72%" height="14px" /></view>
    <view class="skeleton-inline skeleton-filter-row"><SkeletonBase v-for="i in 3" :key="i" width="88px" height="48px" rounded="rounded-lg" /></view>
    <DishListSkeleton />
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
import DishListSkeleton from './DishListSkeleton.vue';
</script>
