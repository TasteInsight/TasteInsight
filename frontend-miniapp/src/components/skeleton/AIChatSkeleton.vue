<template>
  <!-- AI 聊天页面骨架屏 -->
  <view class="w-full h-screen flex flex-col bg-gray-50">
    <!-- 顶部标题栏骨架 -->
    <view class="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      <view class="flex items-center space-x-2">
        <SkeletonBase width="32px" height="32px" rounded="rounded-full" />
        <SkeletonBase width="100px" height="20px" rounded="rounded" />
      </view>
      <SkeletonBase width="24px" height="24px" rounded="rounded" />
    </view>

    <!-- 聊天消息区域骨架 -->
    <view class="flex-1 px-4 py-4 space-y-4 overflow-hidden">
      <!-- AI 消息气泡 1 -->
      <view class="flex items-start space-x-3">
        <SkeletonBase width="36px" height="36px" rounded="rounded-full" />
        <view class="flex-1 max-w-[75%] space-y-2">
          <SkeletonBase width="100%" height="60px" rounded="rounded-2xl" />
        </view>
      </view>

      <!-- 用户消息气泡 -->
      <view class="flex items-start justify-end space-x-3">
        <view class="max-w-[75%]">
          <SkeletonBase width="150px" height="40px" rounded="rounded-2xl" />
        </view>
      </view>

      <!-- AI 消息气泡 2（推荐卡片） -->
      <view class="flex items-start space-x-3">
        <SkeletonBase width="36px" height="36px" rounded="rounded-full" />
        <view class="flex-1 max-w-[80%] space-y-2">
          <SkeletonBase width="80%" height="20px" rounded="rounded" />
          <!-- 推荐卡片骨架 -->
          <view class="bg-white rounded-xl p-3 shadow-sm space-y-3">
            <view class="flex items-center space-x-3">
              <SkeletonBase width="64px" height="64px" rounded="rounded-lg" />
              <view class="flex-1 space-y-2">
                <SkeletonBase width="80%" height="16px" rounded="rounded" />
                <SkeletonBase width="60%" height="12px" rounded="rounded" />
                <SkeletonBase width="40%" height="12px" rounded="rounded" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 用户消息气泡 2 -->
      <view class="flex items-start justify-end">
        <view class="max-w-[75%]">
          <SkeletonBase width="120px" height="40px" rounded="rounded-2xl" />
        </view>
      </view>

      <!-- AI 正在输入指示器 -->
      <view class="flex items-start space-x-3">
        <SkeletonBase width="36px" height="36px" rounded="rounded-full" />
        <view class="flex space-x-1 py-3 px-4 bg-white rounded-2xl">
          <SkeletonBase width="8px" height="8px" rounded="rounded-full" />
          <SkeletonBase width="8px" height="8px" rounded="rounded-full" />
          <SkeletonBase width="8px" height="8px" rounded="rounded-full" />
        </view>
      </view>
    </view>

    <!-- 底部输入栏骨架 -->
    <view class="px-4 py-3 bg-white border-t border-gray-100 flex items-center space-x-3">
      <SkeletonBase width="calc(100% - 56px)" height="40px" rounded="rounded-full" class="flex-1" />
      <SkeletonBase width="40px" height="40px" rounded="rounded-full" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
