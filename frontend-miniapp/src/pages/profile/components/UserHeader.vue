<!-- UserHeader.vue - Tailwind CSS 版本 -->
<template>
  <view class="user-header-wrapper">
    <!-- 加载状态 -->
    <view v-if="loading" class="flex flex-col items-center py-4">
      <view class="w-24 h-24 rounded-full bg-purple-400"></view>
      <view class="mt-4">
        <view class="h-6 w-32 bg-purple-400 rounded"></view>
      </view>
    </view>
    
    <!-- 正常状态 -->
    <view v-else class="w-full">
      <!-- 已登录用户信息 -->
      <view v-if="isLoggedIn && userInfo" class="flex flex-row items-center w-full">
        <!-- 头像区域 -->
        <view class="relative w-20 h-20 rounded-full bg-purple-300 border-4 border-white/30 flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0">
          <image 
            v-if="userInfo?.avatar" 
            :src="userInfo.avatar" 
            mode="aspectFill" 
            class="w-full h-full" 
          />
          <text v-else class="text-white text-4xl">👤</text>
        </view>

        <!-- 用户信息 -->
        <view class="ml-4 flex-1 flex flex-col justify-center">
          <view class="text-xl font-bold text-ts-purple mb-1">{{ userInfo.nickname }}</view>
          <view class="text-ts-purple text-sm opacity-80">ID: {{ userInfo.id }}</view>
        </view>

        <!-- 编辑个人信息按钮 -->
        <view 
          class="ml-2 flex flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full active:bg-gray-100"
          @tap="handleEditProfile"
        >
          <text class="text-sm text-gray-600 mr-1">编辑资料</text>
          <text class="iconify text-gray-400" data-icon="mdi:chevron-right" data-width="16"></text>
        </view>
      </view>
      
      <!-- 未登录状态 -->
      <view v-else class="flex flex-col items-center">
        <view class="relative w-24 h-24 rounded-full bg-purple-300 border-4 border-white/30 flex items-center justify-center overflow-hidden shadow-lg">
           <text class="text-white text-4xl">👤</text>
        </view>
        <view class="mt-4 flex justify-center" >
            <view 
              @tap="handleLoginClick"
              class="bg-white border  border-ts-purple text-ts-purple font-medium  rounded-full px-8 py-3 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            >
              立即登录
            </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { User } from '@/types/api';

defineProps<{
  userInfo: User | null;
  isLoggedIn: boolean;
  loading: boolean;
}>();

const emit = defineEmits(['login']);

function handleLoginClick() {
  console.log('UserHeader 登录按钮被点击');
  emit('login');
}

function handleEditProfile() {
  uni.navigateTo({
    url: '/pages/settings/components/personal',
    fail: (err) => {
      console.error('跳转个人信息页面失败', err);
      uni.showToast({
        title: '跳转失败',
        icon: 'none'
      });
    }
  });
}
</script>
