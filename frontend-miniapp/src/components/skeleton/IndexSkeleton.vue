<template>
  <view class="px-4 py-4 bg-white">
    <!-- 搜索栏骨架 -->
    <SkeletonBase height="2.5rem" class-name="mb-4 rounded-full" />
    
    <!-- 轮播图骨架 -->
    <SkeletonBase height="12rem" class-name="mb-4 rounded-lg" />
    
    <!-- 食堂列表骨架 -->
    <view class="flex justify-between items-center h-32 mb-4">
      <view v-for="i in 3" :key="i" class="flex flex-col items-center">
        <SkeletonBase width="4rem" height="4rem" class-name="rounded-lg mb-2" />
        <SkeletonBase width="3rem" height="0.75rem" />
      </view>
    </view>
    
    <!-- 筛选栏骨架 -->
    <view class="flex gap-2 mb-4">
      <SkeletonBase v-for="i in 4" :key="i" width="4rem" height="2rem" class-name="rounded-full" />
    </view>
    
    <!-- 标题骨架 -->
    <SkeletonBase width="5rem" height="1.5rem" class-name="mb-4" />
    
    <!-- 菜品卡片骨架 -->
    <view v-for="i in 3" :key="i" class="flex gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
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
