<template>
  <view class="review-skeleton-list" role="status" aria-label="正在加载评价">
    <view v-for="i in 3" :key="i" class="review-skeleton-row">
      <view class="skeleton-inline"><SkeletonBase width="36px" height="36px" rounded="rounded-full" /><view class="skeleton-copy"><SkeletonBase width="100px" height="16px" /><SkeletonBase width="70px" height="12px" /></view></view>
      <SkeletonBase width="110px" height="16px" />
      <SkeletonBase width="100%" height="14px" /><SkeletonBase width="75%" height="14px" />
    </view>
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
