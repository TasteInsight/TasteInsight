<template>
  <view class="skeleton-form settings-content-skeleton" role="status" aria-label="正在加载显示设置">
    <view class="settings-skeleton-section">
      <SkeletonBase width="84px" height="24px" />
      <view>
        <view v-for="item in 2" :key="item" class="skeleton-inline settings-skeleton-row">
          <view class="skeleton-copy"
            ><SkeletonBase width="96px" height="20px" /><SkeletonBase width="80%" height="14px"
          /></view>
          <SkeletonBase
            class="settings-skeleton-toggle"
            width="48px"
            height="28px"
            rounded="rounded-full"
          />
        </view>
      </view>
    </view>
    <view class="settings-skeleton-section">
      <SkeletonBase width="120px" height="24px" />
      <view class="skeleton-copy"
        ><SkeletonBase height="48px" rounded="rounded-lg" /><SkeletonBase width="70%" height="14px"
      /></view>
    </view>
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
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}
.settings-skeleton-section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
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
