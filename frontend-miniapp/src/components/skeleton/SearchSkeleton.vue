<template>
  <!-- 搜索页面骨架屏 -->
  <view class="min-h-screen bg-gray-50">
    <!-- 搜索栏骨架 -->
    <view class="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
      <view class="flex items-center border border-gray-200 rounded-full p-0.5 bg-white">
        <SkeletonBase width="22px" height="22px" rounded="rounded" class="ml-2" />
        <view class="flex-1 px-2">
          <SkeletonBase width="60%" height="20px" rounded="rounded" />
        </view>
        <SkeletonBase width="64px" height="36px" rounded="rounded-full" />
      </view>
    </view>

    <!-- 搜索结果骨架 -->
    <view class="px-4 py-3 space-y-6">
      <!-- 食堂结果骨架 -->
      <view>
        <SkeletonBase width="80px" height="16px" rounded="rounded" class="mb-3" />
        <view
          v-for="i in 2"
          :key="'canteen-' + i"
          class="bg-white rounded-xl p-4 mb-3 shadow-sm"
        >
          <view class="flex items-center space-x-3">
            <SkeletonBase width="56px" height="56px" rounded="rounded-lg" />
            <view class="flex-1 space-y-2">
              <SkeletonBase width="70%" height="18px" rounded="rounded" />
              <SkeletonBase width="50%" height="14px" rounded="rounded" />
            </view>
          </view>
        </view>
      </view>

      <!-- 窗口结果骨架 -->
      <view>
        <SkeletonBase width="80px" height="16px" rounded="rounded" class="mb-3" />
        <view
          v-for="i in 2"
          :key="'window-' + i"
          class="bg-white rounded-xl p-4 mb-3 shadow-sm"
        >
          <view class="flex justify-between items-start">
            <view class="flex-1 space-y-2">
              <SkeletonBase width="60%" height="18px" rounded="rounded" />
              <SkeletonBase width="40%" height="14px" rounded="rounded" />
              <view class="flex gap-2 mt-2">
                <SkeletonBase width="48px" height="20px" rounded="rounded-full" />
                <SkeletonBase width="48px" height="20px" rounded="rounded-full" />
              </view>
            </view>
            <SkeletonBase width="20px" height="20px" rounded="rounded" />
          </view>
        </view>
      </view>

      <!-- 菜品结果骨架 -->
      <view>
        <SkeletonBase width="80px" height="16px" rounded="rounded" class="mb-3" />
        <view
          v-for="i in 3"
          :key="'dish-' + i"
          class="bg-white rounded-xl p-4 mb-3 shadow-sm"
        >
          <view class="flex items-center space-x-3">
            <SkeletonBase width="72px" height="72px" rounded="rounded-lg" />
            <view class="flex-1 space-y-2">
              <SkeletonBase width="70%" height="18px" rounded="rounded" />
              <SkeletonBase width="40%" height="14px" rounded="rounded" />
              <view class="flex items-center justify-between">
                <SkeletonBase width="50px" height="16px" rounded="rounded" />
                <SkeletonBase width="60px" height="20px" rounded="rounded" />
              </view>
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
