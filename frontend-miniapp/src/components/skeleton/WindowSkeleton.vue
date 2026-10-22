<template>
  <view class="skeleton-page" role="status" :aria-label="t('common.skeleton.window')">
    <view class="skeleton-copy"
      ><SkeletonBase width="50%" height="24px" /><SkeletonBase width="65%" height="14px"
    /></view>
    <view class="skeleton-inline skeleton-filter-row"
      ><SkeletonBase v-for="i in 3" :key="i" width="76px" height="36px" rounded="rounded-full"
    /></view>
    <DishListSkeleton />
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';

import SkeletonBase from './SkeletonBase.vue';
import DishListSkeleton from './DishListSkeleton.vue';
</script>
