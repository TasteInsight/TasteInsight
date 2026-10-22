<template>
  <view class="skeleton-form" role="status" :aria-label="t('common.skeleton.personal')">
    <view class="skeleton-inline"
      ><SkeletonBase width="64px" height="64px" rounded="rounded-full" /><SkeletonBase
        width="110px"
        height="16px"
    /></view>
    <SkeletonBase width="60px" height="16px" /><SkeletonBase height="48px" rounded="rounded-lg" />
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';

import SkeletonBase from './SkeletonBase.vue';
</script>
