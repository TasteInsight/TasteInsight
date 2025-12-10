<template>
  <!-- 个人信息设置页面骨架屏 -->
  <view class="w-full min-h-screen bg-gray-50 p-4">
    <!-- 头像上传区域骨架 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <SkeletonBase width="48px" height="20px" rounded="rounded" class="mb-6" />
      <view class="flex flex-col items-center">
        <view class="relative mb-6">
          <SkeletonBase width="96px" height="96px" rounded="rounded-full" />
          <view class="absolute bottom-0 right-0">
            <SkeletonBase width="28px" height="28px" rounded="rounded-full" />
          </view>
        </view>
        <SkeletonBase width="160px" height="14px" rounded="rounded" />
      </view>
    </view>

    <!-- 昵称设置骨架 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <SkeletonBase width="48px" height="20px" rounded="rounded" class="mb-4" />
      <SkeletonBase width="100%" height="44px" rounded="rounded-lg" />
    </view>

    <!-- 保存按钮骨架 -->
    <view class="mt-8">
      <SkeletonBase width="100%" height="48px" rounded="rounded-full" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
