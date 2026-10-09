<template>
  <view class="skeleton-page" role="status" aria-label="正在加载规划">
    <view class="skeleton-inline planning-skeleton-tabs">
      <SkeletonBase width="40%" height="24px" />
      <SkeletonBase width="40%" height="24px" />
    </view>
    <view v-for="row in 3" :key="row" class="review-skeleton-row">
      <view class="skeleton-inline">
        <view class="skeleton-copy"
          ><SkeletonBase width="110px" height="18px" /><SkeletonBase width="40px" height="14px"
        /></view>
        <SkeletonBase width="64px" height="24px" />
      </view>
      <view class="skeleton-inline">
        <view class="skeleton-copy"
          ><SkeletonBase width="70%" height="18px" /><SkeletonBase
            width="90%"
            height="14px" /><SkeletonBase width="60px" height="14px"
        /></view>
        <SkeletonBase width="68px" height="68px" rounded="rounded-lg" />
      </view>
      <SkeletonBase width="60%" height="16px" />
    </view>
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
<style scoped>
.planning-skeleton-tabs {
  justify-content: space-around;
  padding: 4px 0 20px;
  border-bottom: 1px solid #eaecf0;
}
</style>
