<template>
  <view class="px-4 py-4 bg-white min-h-screen">
    <!-- 搜索栏骨架 -->
    <SkeletonBase height="2.5rem" class-name="mb-4 rounded-full" />
    
    <!-- 窗口头部信息骨架 -->
    <view class="mb-4 p-4 bg-gray-50 rounded-lg">
      <view class="flex items-center gap-3 mb-3">
        <SkeletonBase width="3.5rem" height="3.5rem" class-name="rounded-lg flex-shrink-0" />
        <view class="flex-1">
          <SkeletonBase width="40%" height="1.25rem" class-name="mb-2" />
          <SkeletonBase width="60%" height="0.875rem" />
        </view>
      </view>
      <SkeletonBase width="80%" height="0.75rem" />
    </view>
    
    <!-- 菜品卡片骨架 -->
    <view v-for="i in 5" :key="i" class="flex gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
      <SkeletonBase width="5rem" height="5rem" class-name="rounded-lg flex-shrink-0" />
      <view class="flex-1">
        <SkeletonBase width="60%" height="1rem" class-name="mb-2" />
        <SkeletonBase width="40%" height="0.75rem" class-name="mb-2" />
        <SkeletonBase width="30%" height="0.75rem" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
