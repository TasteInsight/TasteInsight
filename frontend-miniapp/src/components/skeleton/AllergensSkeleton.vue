<template>
  <view
    class="skeleton-form settings-content-skeleton"
    role="status"
    aria-label="正在加载过敏原设置"
  >
    <view class="skeleton-copy allergens-skeleton-note">
      <SkeletonBase height="14px" /><SkeletonBase height="14px" /><SkeletonBase
        width="70%"
        height="14px"
      />
    </view>
    <view class="allergens-skeleton-section">
      <SkeletonBase width="100px" height="24px" />
      <view class="skeleton-copy">
        <SkeletonBase class="allergens-skeleton-input" height="140px" rounded="rounded-lg" />
        <SkeletonBase class="allergens-skeleton-count" width="44px" height="12px" />
      </view>
    </view>
    <view class="allergens-skeleton-section">
      <SkeletonBase width="100px" height="24px" />
      <view class="allergens-skeleton-options">
        <SkeletonBase
          v-for="item in 13"
          :key="item"
          class="allergens-skeleton-option"
          width="64px"
          height="44px"
          rounded="rounded-lg"
        />
      </view>
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
.allergens-skeleton-note {
  flex: none;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f4f4f5;
}
.allergens-skeleton-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}
.allergens-skeleton-section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.allergens-skeleton-count {
  align-self: flex-end;
}
.allergens-skeleton-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
