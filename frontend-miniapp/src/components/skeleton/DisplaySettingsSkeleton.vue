<template>
  <!-- 显示设置页面骨架屏 -->
  <view class="w-full min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white p-4">
    <!-- 显示选项骨架 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <SkeletonBase width="80px" height="22px" rounded="rounded" class="mb-4" />
      
      <!-- 开关项骨架 -->
      <view v-for="i in 2" :key="i" class="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
        <view class="space-y-1">
          <SkeletonBase width="80px" height="18px" rounded="rounded" />
          <SkeletonBase width="140px" height="12px" rounded="rounded" />
        </view>
        <SkeletonBase width="48px" height="28px" rounded="rounded-full" />
      </view>
    </view>

    <!-- 排序方式骨架 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <SkeletonBase width="96px" height="22px" rounded="rounded" class="mb-4" />
      <SkeletonBase width="100%" height="48px" rounded="rounded-lg" />
    </view>

    <!-- 保存按钮骨架 -->
    <view class="mt-6">
      <SkeletonBase width="100%" height="52px" rounded="rounded-full" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
