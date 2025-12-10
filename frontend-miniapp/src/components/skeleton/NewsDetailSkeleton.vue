<template>
  <view class="bg-white min-h-screen">
    <scroll-view scroll-y class="flex-1 bg-white">
      <view class="p-4 box-border w-full">
        <!-- 标题骨架 -->
        <SkeletonBase width="80%" height="2rem" class-name="mb-2" />
        <SkeletonBase width="60%" height="2rem" class-name="mb-4" />
        
        <!-- 元信息骨架 -->
        <view class="flex justify-between mb-5 pb-2.5 border-b border-gray-200">
          <SkeletonBase width="5rem" height="0.875rem" />
          <SkeletonBase width="8rem" height="0.875rem" />
        </view>
        
        <!-- 内容骨架 -->
        <view class="mb-4">
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="80%" height="0.875rem" class-name="mb-4" />
          
          <!-- 图片占位 -->
          <SkeletonBase width="100%" height="12rem" class-name="rounded-lg mb-4" />
          
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="60%" height="0.875rem" class-name="mb-4" />
          
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
          <SkeletonBase width="40%" height="0.875rem" />
        </view>
        
        <!-- 发布人骨架 -->
        <view class="mt-6 pt-2 border-t border-dashed border-gray-200 text-right">
          <SkeletonBase width="6rem" height="0.75rem" class-name="ml-auto" />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
