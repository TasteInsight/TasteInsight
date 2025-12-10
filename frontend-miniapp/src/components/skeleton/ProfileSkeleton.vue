<template>
  <!-- 个人中心页面骨架屏 -->
  <view class="w-full min-h-screen bg-gray-50">
    <!-- 用户信息头部骨架 -->
    <view class="bg-gradient-to-br from-purple-50 to-white pt-12 pb-6 px-6">
      <view class="flex items-center space-x-4">
        <!-- 头像 -->
        <SkeletonBase width="72px" height="72px" rounded="rounded-full" />
        <!-- 用户信息 -->
        <view class="flex-1 space-y-2">
          <SkeletonBase width="120px" height="22px" rounded="rounded" />
          <SkeletonBase width="80px" height="14px" rounded="rounded" />
        </view>
        <!-- 编辑按钮 -->
        <SkeletonBase width="32px" height="32px" rounded="rounded-full" />
      </view>

      <!-- 统计数据 -->
      <view class="flex justify-around mt-6 py-4 bg-white rounded-xl shadow-sm">
        <view v-for="i in 3" :key="i" class="flex flex-col items-center space-y-1">
          <SkeletonBase width="40px" height="24px" rounded="rounded" />
          <SkeletonBase width="48px" height="12px" rounded="rounded" />
        </view>
      </view>
    </view>

    <!-- 菜单项列表骨架 -->
    <view class="px-4 py-4 space-y-3">
      <!-- 第一组菜单 -->
      <view class="bg-white rounded-xl overflow-hidden shadow-sm">
        <view
          v-for="i in 3"
          :key="i"
          class="flex items-center justify-between p-4 border-b border-gray-50 last:border-b-0"
        >
          <view class="flex items-center space-x-3">
            <SkeletonBase width="24px" height="24px" rounded="rounded" />
            <SkeletonBase width="80px" height="16px" rounded="rounded" />
          </view>
          <SkeletonBase width="20px" height="20px" rounded="rounded" />
        </view>
      </view>

      <!-- 第二组菜单 -->
      <view class="bg-white rounded-xl overflow-hidden shadow-sm">
        <view
          v-for="i in 2"
          :key="i"
          class="flex items-center justify-between p-4 border-b border-gray-50 last:border-b-0"
        >
          <view class="flex items-center space-x-3">
            <SkeletonBase width="24px" height="24px" rounded="rounded" />
            <SkeletonBase width="80px" height="16px" rounded="rounded" />
          </view>
          <SkeletonBase width="20px" height="20px" rounded="rounded" />
        </view>
      </view>

      <!-- 设置按钮 -->
      <view class="bg-white rounded-xl overflow-hidden shadow-sm">
        <view class="flex items-center justify-between p-4">
          <view class="flex items-center space-x-3">
            <SkeletonBase width="24px" height="24px" rounded="rounded" />
            <SkeletonBase width="48px" height="16px" rounded="rounded" />
          </view>
          <SkeletonBase width="20px" height="20px" rounded="rounded" />
        </view>
      </view>

      <!-- 退出登录按钮 -->
      <view class="mt-6">
        <SkeletonBase width="100%" height="48px" rounded="rounded-full" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue';
</script>
