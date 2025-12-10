<template>
  <!-- 标签菜品列表页面骨架屏 -->
  <view class="min-h-screen bg-white">
    <!-- 顶部标题骨架 -->
    <view class="px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
      <view class="flex items-center space-x-2">
        <SkeletonBase width="16px" height="16px" rounded="rounded" />
        <SkeletonBase width="80px" height="22px" rounded="rounded" />
      </view>
      <SkeletonBase width="120px" height="12px" rounded="rounded" class="mt-2" />
    </view>

    <!-- 菜品列表骨架 -->
    <view class="px-4 py-3 space-y-3">
      <view
        v-for="i in 5"
        :key="i"
        class="bg-gray-50 rounded-xl p-3"
      >
        <view class="flex items-center space-x-3">
          <!-- 菜品图片 -->
          <SkeletonBase width="80px" height="80px" rounded="rounded-lg" />
          <!-- 菜品信息 -->
          <view class="flex-1 space-y-2">
            <SkeletonBase width="70%" height="18px" rounded="rounded" />
            <SkeletonBase width="50%" height="14px" rounded="rounded" />
            <view class="flex items-center justify-between">
              <SkeletonBase width="60px" height="14px" rounded="rounded" />
              <SkeletonBase width="50px" height="20px" rounded="rounded" />
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
