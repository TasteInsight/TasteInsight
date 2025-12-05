<template>
  <view class="bg-white min-h-screen pt-16">
    <!-- 图片轮播骨架 -->
    <SkeletonBase height="16rem" class-name="mb-4" :animated="true" />
    
    <!-- 基本信息骨架 -->
    <view class="p-4">
      <!-- 标题和价格 -->
      <view class="flex justify-between items-start mb-4">
        <view class="flex-1">
          <SkeletonBase width="60%" height="1.5rem" class-name="mb-2" />
          <SkeletonBase width="40%" height="0.875rem" />
        </view>
        <SkeletonBase width="4rem" height="1.5rem" />
      </view>
      
      <!-- 标签 -->
      <view class="flex gap-2 mb-4">
        <SkeletonBase v-for="i in 3" :key="i" width="3.5rem" height="1.5rem" class-name="rounded-md" />
      </view>
      
      <!-- 评分信息 -->
      <view class="py-3 border-t border-gray-100">
        <view class="flex justify-between items-start">
          <view class="ml-6 mt-8">
            <SkeletonBase width="3rem" height="1.5rem" class-name="mb-2" />
            <SkeletonBase width="4rem" height="0.75rem" />
          </view>
          <view class="w-40">
            <view v-for="i in 5" :key="i" class="flex items-center gap-2 mb-1">
              <SkeletonBase width="2rem" height="0.625rem" />
              <SkeletonBase width="100%" height="0.5rem" class-name="flex-1 rounded-full" />
            </view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 分隔线 -->
    <view class="h-3 bg-gray-50 border-t border-b border-gray-100"></view>
    
    <!-- 详细信息骨架 -->
    <view class="p-4">
      <SkeletonBase width="4rem" height="1.25rem" class-name="mb-3" />
      <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
      <SkeletonBase width="100%" height="0.875rem" class-name="mb-2" />
      <SkeletonBase width="70%" height="0.875rem" class-name="mb-4" />
      
      <!-- 食材信息 -->
      <SkeletonBase width="4rem" height="1.25rem" class-name="mb-3" />
      <view class="flex flex-wrap gap-2 mb-4">
        <SkeletonBase v-for="i in 5" :key="i" width="3rem" height="1.5rem" class-name="rounded-md" />
      </view>
      
      <!-- 口味信息 -->
      <SkeletonBase width="4rem" height="1.25rem" class-name="mb-3" />
      <view class="grid grid-cols-2 gap-3">
        <view v-for="i in 4" :key="i" class="flex items-center gap-2">
          <SkeletonBase width="2.5rem" height="0.75rem" />
          <SkeletonBase width="100%" height="0.5rem" class-name="flex-1 rounded-full" />
        </view>
      </view>
    </view>
    
    <!-- 分隔线 -->
    <view class="h-3 bg-gray-50 border-t border-b border-gray-100"></view>
    
    <!-- 评价列表骨架 -->
    <view class="p-4">
      <SkeletonBase width="4rem" height="1.25rem" class-name="mb-4" />
      <view v-for="i in 3" :key="i" class="mb-4 pb-4 border-b border-gray-100">
        <view class="flex items-center gap-3 mb-3">
          <SkeletonBase width="2.5rem" height="2.5rem" :rounded-full="true" />
          <view class="flex-1">
            <SkeletonBase width="30%" height="0.875rem" class-name="mb-1" />
            <SkeletonBase width="20%" height="0.625rem" />
          </view>
        </view>
        <SkeletonBase width="100%" height="0.75rem" class-name="mb-1" />
        <SkeletonBase width="80%" height="0.75rem" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
