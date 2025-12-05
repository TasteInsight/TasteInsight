<template>
  <!-- 设置主页面骨架屏 -->
  <view class="w-full min-h-screen bg-gray-50">
    <!-- 标题区域骨架 -->
    <view class="px-6 pt-12 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex items-center">
      <SkeletonBase width="6px" height="24px" rounded="rounded-full" />
      <view class="ml-3">
        <SkeletonBase width="64px" height="28px" rounded="rounded" />
      </view>
    </view>

    <!-- 设置条目列表骨架 -->
    <view class="px-4 py-4 space-y-4">
      <!-- 分组 1: 个人与偏好 -->
      <view class="bg-white rounded-lg shadow-sm overflow-hidden">
        <view
          v-for="i in 3"
          :key="i"
          class="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0"
        >
          <SkeletonBase width="100px" height="18px" rounded="rounded" />
          <SkeletonBase width="24px" height="24px" rounded="rounded" />
        </view>
      </view>

      <!-- 分组 2: 系统设置 -->
      <view class="bg-white rounded-lg shadow-sm overflow-hidden">
        <view
          v-for="i in 2"
          :key="i"
          class="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0"
        >
          <SkeletonBase width="80px" height="18px" rounded="rounded" />
          <SkeletonBase width="24px" height="24px" rounded="rounded" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
