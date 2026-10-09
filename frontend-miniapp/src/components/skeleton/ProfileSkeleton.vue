<template>
  <view role="status" aria-label="正在加载个人中心">
    <view class="skeleton-inline skeleton-profile-header"><SkeletonBase width="64px" height="64px" rounded="rounded-full" /><view class="skeleton-copy"><SkeletonBase width="130px" height="22px" /><SkeletonBase width="96px" height="14px" /></view></view>
    <view v-for="i in 6" :key="i" class="skeleton-menu-row"><SkeletonBase width="24px" height="24px" /><SkeletonBase width="90px" height="16px" /></view>
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
