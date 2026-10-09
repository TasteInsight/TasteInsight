<template>
  <view role="status" aria-label="正在搜索">
    <SkeletonBase width="90px" height="18px" />
    <DishListSkeleton />
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
import DishListSkeleton from './DishListSkeleton.vue';
</script>
