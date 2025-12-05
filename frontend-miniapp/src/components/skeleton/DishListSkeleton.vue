<template>
  <!-- 菜品列表页面骨架屏（适用于历史浏览、我的收藏等） -->
  <view class="w-full min-h-screen bg-white pb-4">
    <!-- 标题栏骨架 -->
    <view class="flex items-center px-4 py-3 border-b border-gray-100">
      <SkeletonBase width="4px" height="16px" rounded="rounded-full" />
      <view class="ml-2">
        <SkeletonBase width="80px" height="18px" rounded="rounded" />
      </view>
    </view>

    <!-- 菜品列表骨架 -->
    <view class="px-4 py-3 space-y-3">
      <view
        v-for="i in 5"
        :key="i"
        class="flex items-center p-3 bg-gray-50 rounded-xl"
      >
        <!-- 菜品图片 -->
        <SkeletonBase width="72px" height="72px" rounded="rounded-lg" />
        <!-- 菜品信息 -->
        <view class="flex-1 ml-3 space-y-2">
          <SkeletonBase width="60%" height="18px" rounded="rounded" />
          <SkeletonBase width="40%" height="14px" rounded="rounded" />
          <view class="flex items-center justify-between">
            <SkeletonBase width="50px" height="14px" rounded="rounded" />
            <SkeletonBase width="60px" height="20px" rounded="rounded" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
