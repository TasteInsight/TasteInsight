<template>
  <view class="skeleton-form settings-content-skeleton" role="status" aria-label="正在加载饮食偏好">
    <view class="preferences-skeleton-section">
      <SkeletonBase class="preferences-skeleton-heading" width="84px" height="24px" />
      <SkeletonBase width="80%" height="14px" />
      <view v-for="item in 4" :key="item" class="preferences-skeleton-taste-row">
        <view class="skeleton-inline preferences-skeleton-taste-label"
          ><SkeletonBase width="48px" height="20px" /><SkeletonBase width="44px" height="14px"
        /></view>
        <view class="preferences-skeleton-slider"
          ><SkeletonBase height="6px" rounded="rounded-full" /><SkeletonBase
            class="preferences-skeleton-thumb"
            width="24px"
            height="24px"
            rounded="rounded-full"
        /></view>
      </view>
    </view>
    <view class="preferences-skeleton-section">
      <SkeletonBase class="preferences-skeleton-heading" width="48px" height="24px" />
      <view class="preferences-skeleton-portion"
        ><SkeletonBase v-for="item in 3" :key="item" height="44px" rounded="rounded-lg"
      /></view>
    </view>
    <view class="preferences-skeleton-section">
      <SkeletonBase class="preferences-skeleton-heading" width="84px" height="24px" />
      <view class="preferences-skeleton-price">
        <view v-for="item in 2" :key="item" class="skeleton-copy preferences-skeleton-price-field"
          ><SkeletonBase width="80px" height="14px" /><SkeletonBase
            height="48px"
            rounded="rounded-lg"
        /></view>
      </view>
    </view>
    <view
      v-for="item in 3"
      :key="item"
      class="preferences-skeleton-section preferences-skeleton-ingredient"
    >
      <SkeletonBase class="preferences-skeleton-heading" width="100px" height="24px" />
      <view class="skeleton-inline"
        ><view class="skeleton-copy"><SkeletonBase height="48px" rounded="rounded-lg" /></view
        ><SkeletonBase width="56px" height="44px" rounded="rounded-lg"
      /></view>
    </view>
    <view class="preferences-skeleton-section preferences-skeleton-canteen">
      <SkeletonBase class="preferences-skeleton-heading" width="84px" height="24px" />
      <SkeletonBase height="48px" rounded="rounded-lg" />
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
.preferences-skeleton-section {
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}
.preferences-skeleton-section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.preferences-skeleton-heading {
  margin-bottom: 16px;
}
.preferences-skeleton-taste-row {
  padding-top: 18px;
}
.preferences-skeleton-taste-label {
  justify-content: space-between;
}
.preferences-skeleton-slider {
  position: relative;
  display: flex;
  align-items: center;
  height: 24px;
  margin: 14px 10px 0;
}
.preferences-skeleton-thumb {
  position: absolute;
  top: 0;
  left: calc(50% - 12px);
}
.preferences-skeleton-portion {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.preferences-skeleton-price {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
</style>
