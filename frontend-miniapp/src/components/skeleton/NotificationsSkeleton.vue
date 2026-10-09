<template>
  <view class="skeleton-form settings-content-skeleton" role="status" aria-label="正在加载通知设置">
    <view class="settings-skeleton-section">
      <view v-for="item in 4" :key="item" class="skeleton-inline settings-skeleton-row">
        <view class="skeleton-copy"
          ><SkeletonBase width="96px" height="20px" /><SkeletonBase width="90%" height="14px"
        /></view>
        <SkeletonBase
          class="settings-skeleton-toggle"
          width="48px"
          height="28px"
          rounded="rounded-full"
        />
      </view>
    </view>
    <SkeletonBase width="80%" height="14px" />
  </view>
</template>
<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
<style scoped>
.settings-content-skeleton {
  gap: 24px;
  padding: 0;
  background: #fff;
}
.settings-skeleton-section {
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}
.settings-skeleton-row {
  gap: 16px;
  min-height: 64px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}
.settings-skeleton-row:last-child {
  border-bottom: 0;
}
</style>
