<template>
  <view class="px-4 py-4 bg-gray-100 min-h-screen">
    <!-- 标题骨架 -->
    <SkeletonBase width="5rem" height="1.5rem" class-name="mb-4" />
    
    <!-- 新闻卡片骨架 -->
    <view v-for="i in 5" :key="i" class="bg-white rounded-xl p-4 mb-3 border border-gray-100">
      <!-- 标题 -->
      <SkeletonBase width="80%" height="1rem" class-name="mb-2" />
      <SkeletonBase width="100%" height="1rem" class-name="mb-3" />
      
      <!-- 摘要 -->
      <SkeletonBase width="100%" height="0.875rem" class-name="mb-1" />
      <SkeletonBase width="60%" height="0.875rem" class-name="mb-3" />
      
      <!-- 底部标签和时间 -->
      <view class="flex justify-between items-center">
        <SkeletonBase width="4rem" height="1.5rem" class-name="rounded-md" />
        <SkeletonBase width="5rem" height="0.75rem" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
