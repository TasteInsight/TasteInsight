<template>
  <!-- 偏好设置页面骨架屏 -->
  <view class="w-full min-h-screen bg-gray-50 p-4 pb-10">
    <!-- 口味偏好骨架 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <SkeletonBase width="80px" height="22px" rounded="rounded" class="mb-6" />

      <!-- 滑块项骨架 -->
      <view v-for="i in 4" :key="i" class="mb-8 last:mb-2">
        <view class="flex justify-between items-center mb-3">
          <SkeletonBase width="48px" height="18px" rounded="rounded" />
          <SkeletonBase width="40px" height="22px" rounded="rounded" />
        </view>
        <SkeletonBase width="100%" height="24px" rounded="rounded-full" />
        <view class="flex justify-between mt-2 px-1">
          <SkeletonBase v-for="j in 6" :key="j" width="32px" height="20px" rounded="rounded" />
        </view>
      </view>
    </view>

    <!-- 喜好食材骨架 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <SkeletonBase width="80px" height="22px" rounded="rounded" class="mb-4" />
      <view class="flex items-center space-x-2 mb-4">
        <SkeletonBase width="calc(100% - 72px)" height="44px" rounded="rounded-lg" class="flex-1" />
        <SkeletonBase width="56px" height="44px" rounded="rounded-lg" />
      </view>
      <view class="flex flex-wrap gap-2">
        <SkeletonBase v-for="i in 4" :key="i" width="72px" height="32px" rounded="rounded-lg" />
      </view>
    </view>

    <!-- 分量偏好骨架 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <SkeletonBase width="80px" height="22px" rounded="rounded" class="mb-4" />
      <SkeletonBase width="100%" height="44px" rounded="rounded-lg" />
    </view>

    <!-- 保存按钮骨架 -->
    <view class="mt-8">
      <SkeletonBase width="100%" height="52px" rounded="rounded-full" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
