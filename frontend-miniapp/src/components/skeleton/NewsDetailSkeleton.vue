<template>
  <view class="skeleton-page news-detail-skeleton" role="status" aria-label="正在加载公告">
    <view class="skeleton-copy">
      <SkeletonBase width="92%" height="28px" />
      <SkeletonBase width="62%" height="28px" />
    </view>
    <view class="skeleton-inline news-skeleton-meta">
      <SkeletonBase width="72px" height="14px" />
      <SkeletonBase width="120px" height="14px" />
    </view>
    <view v-for="paragraph in 3" :key="paragraph" class="skeleton-copy news-skeleton-paragraph">
      <SkeletonBase width="100%" height="16px" />
      <SkeletonBase width="100%" height="16px" />
      <SkeletonBase width="78%" height="16px" />
    </view>
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
<style scoped>
.news-detail-skeleton {
  max-width: 760px;
  margin: 0 auto;
  padding-top: 24px;
}
.news-skeleton-meta {
  flex-wrap: wrap;
  margin: 20px 0 28px;
}
.news-skeleton-paragraph {
  gap: 14px;
  margin-bottom: 28px;
}
</style>
