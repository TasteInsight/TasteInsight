<!-- UserHeader.vue-->
<template>
  <view class="user-header-wrapper">
    <!-- 正常状态 -->
    <view class="w-full">
      <!-- 已登录用户信息 -->
      <view v-if="isLoggedIn" class="w-full">
        <view v-if="userInfo" class="flex flex-row items-center w-full relative">
          <!-- 头像区域 -->
          <view class="relative w-20 h-20 rounded-full border-2 border-white shadow-md flex-shrink-0 overflow-hidden bg-gray-50">
            <image 
              v-if="userInfo?.avatar" 
              :src="userInfo.avatar" 
              mode="aspectFill" 
              class="w-full h-full" 
            />
            <view v-else class="w-full h-full flex items-center justify-center bg-purple-50">
              <text class="iconfont icon-account text-purple-300" style="font-size: 40px; line-height:1"></text>
            </view>
          </view>

          <!-- 用户信息 -->
          <view class="ml-4 flex-1 flex flex-col self-stretch relative">
            <view class="flex-1 flex items-center">
              <view class="text-xl font-bold text-ts-purple">{{ userInfo.nickname }}</view>
            </view>
            
            <!-- 编辑个人信息按钮 (右下角) -->
            <view class="absolute bottom-0 right-0">
              <view 
                class="flex flex-row items-center bg-ts-purple px-3 py-1.5 rounded-full active:bg-purple-800 shadow-sm"
                @tap="handleEditProfile"
              >
                <text class="iconfont icon-cog-outline text-white mr-1" style="font-size: 14px; line-height:1"></text>
                <text class="text-xs text-white">编辑资料</text>
                <text class="iconfont icon-chevronright text-white ml-1" style="font-size: 14px; line-height:1"></text>
              </view>
            </view>
          </view>
        </view>
        
        <!-- 已登录但数据未加载完成时的骨架屏占位 -->
        <view v-else class="flex flex-col items-center py-4">
           <view class="w-24 h-24 rounded-full bg-gray-200 animate-pulse"></view>
           <view class="mt-4 h-6 w-32 bg-gray-200 rounded animate-pulse"></view>
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
import {Icon} from '@iconify/vue';

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
