<template>
  <view class="min-h-screen bg-white flex flex-col relative pt-safe">
    <!-- 背景装饰 -->
    <view class="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-purple-50 to-white -z-10"></view>
    
    <view class="flex-1 flex flex-col items-center justify-center px-8">
      <LoginForm @login-success="handleLoginSuccess" @login-error="handleLoginError" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow, onLoad } from '@dcloudio/uni-app';
import LoginForm from './components/LoginForm.vue';
import { useUserStore } from '@/store/modules/use-user-store';

const userStore = useUserStore();

/**
 * 页面加载时检查登录状态
 */
onLoad(() => {
  // 如果已登录，直接跳转到首页
  if (userStore.isLoggedIn) {
    uni.switchTab({
      url: '/pages/index/index'
    });
  }
});

/**
 * 页面显示时再次检查（处理返回的情况）
 */
onShow(() => {
  // 如果已登录，直接跳转到首页
  if (userStore.isLoggedIn) {
    uni.switchTab({
      url: '/pages/index/index'
    });
  }
});

/**
 * 处理登录成功
 */
function handleLoginSuccess() {
  // 登录成功由 use-login.ts 处理跳转
}

/**
 * 处理登录失败
 * @param {Error} error - 登录过程中捕获的错误
 */
function handleLoginError(error: Error) {
  console.error('登录失败:', error);
  uni.showToast({
    title: '登录失败，请重试',
    icon: 'none'
  });
}
</script>