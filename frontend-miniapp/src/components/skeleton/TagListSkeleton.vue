<template>
  <view class="skeleton-page" role="status" :aria-label="t('common.skeleton.tags')"
    ><DishListSkeleton
  /></view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';

import DishListSkeleton from './DishListSkeleton.vue';
</script>
