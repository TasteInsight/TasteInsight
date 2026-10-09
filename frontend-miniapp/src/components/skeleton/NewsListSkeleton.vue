<template>
  <view class="skeleton-page" role="status" aria-label="正在加载公告">
    <view v-for="i in 4" :key="i" class="review-skeleton-row">
      <SkeletonBase width="85%" height="20px" /><SkeletonBase width="100%" height="14px" /><SkeletonBase width="70%" height="14px" />
      <view class="skeleton-inline"><SkeletonBase width="78px" height="24px" rounded="rounded-full" /><SkeletonBase width="80px" height="12px" /></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
