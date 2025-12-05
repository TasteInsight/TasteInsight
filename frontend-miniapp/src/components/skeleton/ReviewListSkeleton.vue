<template>
  <!-- 评价列表页面骨架屏（适用于我的评价） -->
  <view class="w-full min-h-screen bg-gray-50 pb-4">
    <!-- 标题栏骨架 -->
    <view class="flex items-center px-4 py-3 border-b border-gray-200 mb-3 bg-white">
      <SkeletonBase width="4px" height="16px" rounded="rounded-full" />
      <view class="ml-2">
        <SkeletonBase width="72px" height="18px" rounded="rounded" />
      </view>
    </view>

    <!-- 评价列表骨架 -->
    <view class="px-4 space-y-4">
      <view
        v-for="i in 4"
        :key="i"
        class="bg-white rounded-xl p-4 shadow-sm"
      >
        <!-- 评价头部：菜品信息 -->
        <view class="flex items-center space-x-3 mb-3 pb-3 border-b border-gray-100">
          <SkeletonBase width="48px" height="48px" rounded="rounded-lg" />
          <view class="flex-1 space-y-1">
            <SkeletonBase width="60%" height="16px" rounded="rounded" />
            <SkeletonBase width="40%" height="12px" rounded="rounded" />
          </view>
        </view>

        <!-- 评分星星 -->
        <view class="flex items-center space-x-1 mb-2">
          <SkeletonBase v-for="j in 5" :key="j" width="16px" height="16px" rounded="rounded" />
          <SkeletonBase width="40px" height="14px" rounded="rounded" class="ml-2" />
        </view>

        <!-- 评价内容 -->
        <view class="space-y-2">
          <SkeletonBase width="100%" height="14px" rounded="rounded" />
          <SkeletonBase width="80%" height="14px" rounded="rounded" />
        </view>

        <!-- 评价底部：时间 -->
        <view class="flex justify-end mt-3">
          <SkeletonBase width="80px" height="12px" rounded="rounded" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
