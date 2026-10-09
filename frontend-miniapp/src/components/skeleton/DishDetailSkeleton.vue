<template>
  <view class="skeleton-page" role="status" aria-label="正在加载菜品">
    <view class="dish-detail-skeleton-summary skeleton-copy">
      <SkeletonBase width="62%" height="26px" /><SkeletonBase width="80%" height="14px" />
      <view class="skeleton-inline"><SkeletonBase width="60px" height="24px" /><SkeletonBase width="110px" height="18px" /></view>
      <view class="skeleton-inline"><SkeletonBase width="52px" height="24px" rounded="rounded-full" /><SkeletonBase width="48px" height="24px" rounded="rounded-full" /></view>
    </view>
    <ReviewListSkeleton />
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
import ReviewListSkeleton from './ReviewListSkeleton.vue';
</script>
