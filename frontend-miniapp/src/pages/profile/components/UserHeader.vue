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
    <view v-else class="flex flex-col items-center">
      <!-- 头像区域 -->
      <view class="relative w-24 h-24 rounded-full bg-purple-300 border-4 border-white/30 flex items-center justify-center overflow-hidden shadow-lg">
        <image 
          v-if="isLoggedIn && userInfo?.avatar" 
          :src="userInfo.avatar" 
          mode="aspectFill" 
          class="w-full h-full" 
        />
        <text v-else class="text-white text-4xl">👤</text>
      </view>

      <!-- 已登录用户信息 -->
      <view v-if="isLoggedIn && userInfo" class="text-center mt-4">
        <view class="text-xl font-bold text-ts-purple mb-2">{{ userInfo.nickname }}</view>
        <view class="text-ts-purple text-sm mt-1">ID: {{ userInfo.id }}</view>
      </view>
      
      <!-- 未登录状态 -->
      <view v-else class="text-center mt-4">
        <view class="mt-4 flex justify-center" >
            <view 
              @tap="handleLoginClick"
              @click="handleLoginClick"
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
</script>
