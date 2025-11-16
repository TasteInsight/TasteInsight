<template>
  <view class="w-full h-[812px] bg-white overflow-hidden flex shadow-lg flex-col relative" style="max-width: 375px;">
    <view class="bg-white flex-1 flex items-center justify-center p-6">
      <LoginForm @login-success="handleLoginSuccess" />
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
    // 或者跳转到首页：uni.switchTab({ url: '/pages/index/index' })
  }, 1500);
}
</script>