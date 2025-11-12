<!-- UserHeader.vue 临时测试版本 -->
<template>
  <view class="user-header-wrapper">
    <view v-if="loading" style="display: flex; flex-direction: column; align-items: center; padding: 16px 0;">
      <view style="width: 96px; height: 96px; border-radius: 50%; background-color: #a78bfa;"></view>
      <view style="margin-top: 16px;">
        <view style="height: 24px; width: 128px; background-color: #a78bfa; border-radius: 4px;"></view>
      </view>
    </view>
    
    <view v-else style="display: flex; flex-direction: column; align-items: center;">
      <!-- 头像区域 -->
      <view style="width: 96px; height: 96px; border-radius: 50%; background-color: #d8b4fe; border: 4px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
        <image v-if="isLoggedIn && userInfo?.avatar" :src="userInfo.avatar" mode="aspectFill" style="width: 100%; height: 100%;" />
        <text v-else style="color: white; font-size: 40px;">👤</text>
      </view>

      <!-- 用户信息 -->
      <view v-if="isLoggedIn && userInfo" style="text-align: center; margin-top: 16px;">
        <view style="font-size: 20px; font-weight: bold; color: white;">{{ userInfo.nickname }}</view>
        <view style="color: #e9d5ff; font-size: 14px; margin-top: 4px;">ID: {{ userInfo.id }}</view>
      </view>
      
      <!-- 未登录状态 -->
      <view v-else style="text-align: center; margin-top: 16px;">
        <view style="font-size: 20px; font-weight: bold; color: white; margin-bottom: 8px;">点击登录</view>
        <view style="margin-top: 8px; display: flex; justify-content: center;">
          <view 
            @click="emit('login')" 
            style="background-color: white; color: #9333ea; border-radius: 9999px; padding: 12px 32px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: inline-block;"
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
</script>