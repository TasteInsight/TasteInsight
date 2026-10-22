<template>
  <view role="status" :aria-label="t('common.skeleton.search')">
    <SkeletonBase width="90px" height="18px" />
    <DishListSkeleton />
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';

import SkeletonBase from './SkeletonBase.vue';
import DishListSkeleton from './DishListSkeleton.vue';
</script>
