<template>
  <view class="dish-skeleton-list" role="status" aria-label="正在加载菜品">
    <view v-for="row in rows" :key="row" class="dish-skeleton-row">
      <view class="skeleton-copy">
        <SkeletonBase width="68%" height="18px" />
        <SkeletonBase width="86%" height="13px" />
        <view class="skeleton-inline"
          ><SkeletonBase width="48px" height="22px" rounded="rounded-full" /><SkeletonBase
            width="42px"
            height="22px"
            rounded="rounded-full"
        /></view>
        <SkeletonBase width="70px" height="16px" />
      </view>
      <SkeletonBase width="84px" height="84px" rounded="rounded-lg" class="dish-skeleton-media" />
    </view>
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 });
</script>
