<template>
  <!-- 过敏原设置页面骨架屏 -->
  <view class="w-full min-h-screen p-4 bg-gray-50">
    <!-- 说明文字骨架 -->
    <view class="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
      <SkeletonBase width="90%" height="16px" rounded="rounded" />
    </view>

    <!-- 过敏原输入区域骨架 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <SkeletonBase width="80px" height="20px" rounded="rounded" class="mb-4" />
      <SkeletonBase width="100%" height="120px" rounded="rounded-lg" />
    </view>

    <!-- 常见过敏原快速选择骨架 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <SkeletonBase width="96px" height="20px" rounded="rounded" class="mb-4" />
      <view class="flex flex-wrap gap-3">
        <SkeletonBase v-for="i in 8" :key="i" width="64px" height="32px" rounded="rounded-full" />
      </view>
    </view>

    <!-- 保存按钮骨架 -->
    <view class="mt-8">
      <SkeletonBase width="100%" height="48px" rounded="rounded-full" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
