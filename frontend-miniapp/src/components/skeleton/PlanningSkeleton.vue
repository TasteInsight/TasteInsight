<template>
  <!-- 规划页面骨架屏 -->
  <view class="w-full min-h-screen bg-gray-50 pb-20">
    <!-- 顶部 Tab 栏骨架 -->
    <view class="flex items-center justify-center space-x-8 py-4 bg-white border-b border-gray-100">
      <SkeletonBase width="64px" height="24px" rounded="rounded-lg" />
      <SkeletonBase width="64px" height="24px" rounded="rounded-lg" />
    </view>

    <!-- 计划卡片列表骨架 -->
    <view class="px-4 py-4 space-y-4">
      <view
        v-for="i in 3"
        :key="i"
        class="bg-white rounded-xl p-4 shadow-sm"
      >
        <!-- 卡片头部：日期和状态 -->
        <view class="flex justify-between items-center mb-4">
          <SkeletonBase width="120px" height="20px" rounded="rounded" />
          <SkeletonBase width="60px" height="24px" rounded="rounded-full" />
        </view>

        <!-- 餐次列表 -->
        <view class="space-y-3">
          <view v-for="j in 3" :key="j" class="flex items-center space-x-3">
            <!-- 餐次标签 -->
            <SkeletonBase width="40px" height="20px" rounded="rounded" />
            <!-- 菜品缩略图 -->
            <SkeletonBase width="48px" height="48px" rounded="rounded-lg" />
            <!-- 菜品信息 -->
            <view class="flex-1 space-y-2">
              <SkeletonBase width="80%" height="16px" rounded="rounded" />
              <SkeletonBase width="50%" height="12px" rounded="rounded" />
            </view>
          </view>
        </view>

        <!-- 卡片底部：营养信息 -->
        <view class="mt-4 pt-3 border-t border-gray-100 flex justify-between">
          <SkeletonBase width="60px" height="16px" rounded="rounded" />
          <SkeletonBase width="80px" height="16px" rounded="rounded" />
          <SkeletonBase width="60px" height="16px" rounded="rounded" />
        </view>
      </view>
    </view>

    <!-- 底部浮动按钮骨架 -->
    <view class="fixed bottom-20 right-4">
      <SkeletonBase width="56px" height="56px" rounded="rounded-full" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
