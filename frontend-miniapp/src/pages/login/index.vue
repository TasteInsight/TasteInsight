<template>
  <view class="min-h-screen bg-white flex flex-col relative">
    <!-- 背景装饰 -->
    <view class="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-purple-50 to-white -z-10"></view>
    
    <view class="flex-1 flex flex-col items-center justify-center px-8">
      <LoginForm @login-success="handleLoginSuccess" @login-error="handleLoginError" />
    </view>
  </view>
</template>

<script setup lang="ts">
import LoginForm from './components/LoginForm.vue';
import { useUserStore } from '@/store/modules/use-user-store';

const userStore = useUserStore();

/**
 * 处理登录成功
 */
function handleLoginSuccess() {
  uni.showToast({
    title: '登录成功',
    icon: 'success'
  });

  // 返回上一页或跳转到首页
  setTimeout(() => {
    uni.navigateBack();
  }, 1500);
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