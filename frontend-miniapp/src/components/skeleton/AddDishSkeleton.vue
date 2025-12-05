<template>
  <!-- 添加菜品页面骨架屏 -->
  <view class="min-h-screen bg-gray-50 pb-32">
    <!-- 顶部标题骨架 -->
    <view class="bg-white px-4 py-4 mb-2">
      <SkeletonBase width="120px" height="24px" rounded="rounded" />
      <SkeletonBase width="160px" height="14px" rounded="rounded" class="mt-2" />
    </view>

    <!-- 表单内容骨架 -->
    <view class="space-y-2">
      <!-- 基本信息 -->
      <view class="bg-white px-4 py-4">
        <SkeletonBase width="72px" height="18px" rounded="rounded" class="mb-4" />
        
        <!-- 菜品名称 -->
        <view class="mb-4">
          <SkeletonBase width="80px" height="14px" rounded="rounded" class="mb-2" />
          <SkeletonBase width="100%" height="40px" rounded="rounded-lg" />
        </view>

        <!-- 价格 -->
        <view class="mb-4">
          <SkeletonBase width="60px" height="14px" rounded="rounded" class="mb-2" />
          <view class="flex items-center gap-3">
            <SkeletonBase width="120px" height="40px" rounded="rounded-lg" class="flex-1" />
            <SkeletonBase width="64px" height="40px" rounded="rounded-lg" />
          </view>
        </view>

        <!-- 描述 -->
        <view>
          <SkeletonBase width="72px" height="14px" rounded="rounded" class="mb-2" />
          <SkeletonBase width="100%" height="80px" rounded="rounded-lg" />
        </view>
      </view>

      <!-- 位置信息 -->
      <view class="bg-white px-4 py-4">
        <SkeletonBase width="72px" height="18px" rounded="rounded" class="mb-4" />
        
        <!-- 选择食堂 -->
        <view class="mb-4">
          <SkeletonBase width="80px" height="14px" rounded="rounded" class="mb-3" />
          <view class="grid grid-cols-3 gap-2">
            <SkeletonBase v-for="i in 6" :key="i" width="100%" height="36px" rounded="rounded-lg" />
          </view>
        </view>
      </view>

      <!-- 供应时段 -->
      <view class="bg-white px-4 py-4">
        <SkeletonBase width="80px" height="18px" rounded="rounded" class="mb-4" />
        <view class="flex flex-wrap gap-2">
          <SkeletonBase v-for="i in 3" :key="i" width="64px" height="36px" rounded="rounded-full" />
        </view>
      </view>

      <!-- 菜品标签 -->
      <view class="bg-white px-4 py-4">
        <SkeletonBase width="72px" height="18px" rounded="rounded" class="mb-4" />
        <view class="flex flex-wrap gap-2">
          <SkeletonBase v-for="i in 8" :key="i" width="56px" height="32px" rounded="rounded-full" />
        </view>
      </view>

      <!-- 图片上传 -->
      <view class="bg-white px-4 py-4">
        <SkeletonBase width="72px" height="18px" rounded="rounded" class="mb-4" />
        <view class="flex gap-3">
          <SkeletonBase width="100px" height="100px" rounded="rounded-lg" />
          <SkeletonBase width="100px" height="100px" rounded="rounded-lg" />
        </view>
      </view>
    </view>

    <!-- 底部按钮骨架 -->
    <view class="fixed bottom-0 left-0 right-0 bg-white px-4 py-4 border-t border-gray-100">
      <SkeletonBase width="100%" height="48px" rounded="rounded-lg" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
