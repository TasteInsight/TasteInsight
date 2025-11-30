<template>
  <view class="w-full min-h-screen bg-gray-50">
    <!-- 标题区域 -->
    <view class="px-6 pt-12 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10 flex items-center">
      <view class="w-1.5 h-6 bg-ts-purple rounded-full mr-3 shadow-sm"></view>
      <text class="text-2xl font-bold text-gray-800">设置</text>
    </view>

    <!-- 设置条目列表 -->
    <view class="px-4 py-4 space-y-4">
      
      <!-- 分组 1: 个人与偏好 -->
      <view class="bg-white rounded-lg shadow-sm overflow-hidden">
        <!-- 个人信息设置 -->
        <view
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors relative"
          @click="navigateTo('/pages/settings/components/personal')"
        >
          <text class="text-base font-medium text-gray-800">个人信息设置</text>
          <text class="iconify text-purple-300" data-icon="mdi:chevron-right" data-width="24"></text>
          <view class="absolute bottom-0 left-4 right-0 h-[1px] bg-gray-200"></view>
        </view>

        <!-- 过敏原设置 -->
        <view
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors relative"
          @click="navigateTo('/pages/settings/components/allergens')"
        >
          <text class="text-base font-medium text-gray-800">过敏原设置</text>
          <text class="iconify text-purple-300" data-icon="mdi:chevron-right" data-width="24"></text>
          <view class="absolute bottom-0 left-4 right-0 h-[1px] bg-gray-200"></view>
        </view>

        <!-- 偏好设置 -->
        <view
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors"
          @click="navigateTo('/pages/settings/components/preferences')"
        >
          <text class="text-base font-medium text-gray-800">偏好设置</text>
          <text class="iconify text-purple-300" data-icon="mdi:chevron-right" data-width="24"></text>
        </view>
      </view>

      <!-- 分组 2: 系统设置 -->
      <view class="bg-white rounded-lg shadow-sm overflow-hidden">
        <!-- 显示设置 -->
        <view
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors relative"
          @click="navigateTo('/pages/settings/components/display')"
        >
          <text class="text-base font-medium text-gray-800">显示设置</text>
          <text class="iconify text-purple-300" data-icon="mdi:chevron-right" data-width="24"></text>
          <view class="absolute bottom-0 left-4 right-0 h-[1px] bg-gray-200"></view>
        </view>

        <!-- 通知设置 -->
        <view
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors"
          @click="navigateTo('/pages/settings/components/notifications')"
        >
          <text class="text-base font-medium text-gray-800">通知设置</text>
          <text class="iconify text-purple-300" data-icon="mdi:chevron-right" data-width="24"></text>
        </view>
      </view>

    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 页面跳转方法
 */
function navigateTo(path: string) {
  console.log('设置页跳转:', path);
  uni.navigateTo({
    url: path,
    fail: (err) => {
      console.error('跳转失败:', path, err);
      uni.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    }
  });
}
</script>
