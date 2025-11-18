<template>
  <view class="w-full min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white" style="max-width: 375px;">
    <!-- 标题区域 -->
    <view class="px-6 pt-12 pb-6">
      <text class="text-2xl font-bold text-gray-800">设置</text>
    </view>

    <!-- 设置条目列表 -->
    <view class="px-4 space-y-3">
      <!-- 个人信息设置 -->
      <view
        class="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
        @click="navigateTo('/pages/settings/personal')"
      >
        <view class="flex items-center">
          <view class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
            <text class="text-xl">👤</text>
          </view>
          <text class="text-base font-medium text-gray-800">个人信息设置</text>
        </view>
        <text class="text-gray-400 text-lg">›</text>
      </view>

      <!-- 过敏原设置 -->
      <view
        class="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
        @click="navigateTo('/pages/settings/allergens')"
      >
        <view class="flex items-center">
          <view class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-4">
            <text class="text-xl">⚠️</text>
          </view>
          <text class="text-base font-medium text-gray-800">过敏原设置</text>
        </view>
        <text class="text-gray-400 text-lg">›</text>
      </view>

      <!-- 偏好设置 -->
      <view
        class="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
        @click="navigateTo('/pages/settings/preferences')"
      >
        <view class="flex items-center">
          <view class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-4">
            <text class="text-xl">❤️</text>
          </view>
          <text class="text-base font-medium text-gray-800">偏好设置</text>
        </view>
        <text class="text-gray-400 text-lg">›</text>
      </view>

      <!-- 显示设置 -->
      <view
        class="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
        @click="navigateTo('/pages/settings/display')"
      >
        <view class="flex items-center">
          <view class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
            <text class="text-xl">🎨</text>
          </view>
          <text class="text-base font-medium text-gray-800">显示设置</text>
        </view>
        <text class="text-gray-400 text-lg">›</text>
      </view>

      <!-- 通知设置 -->
      <view
        class="flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
        @click="navigateTo('/pages/settings/notifications')"
      >
        <view class="flex items-center">
          <view class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
            <text class="text-xl">🔔</text>
          </view>
          <text class="text-base font-medium text-gray-800">通知设置</text>
        </view>
        <text class="text-gray-400 text-lg">›</text>
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
