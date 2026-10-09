<template>
  <view class="page-content login-page">
    <view class="login-content">
      <LoginForm @login-success="handleLoginSuccess" @login-error="handleLoginError" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow, onLoad } from '@dcloudio/uni-app';
import LoginForm from './components/LoginForm.vue';
import { useUserStore } from '@/store/modules/use-user-store';

// 显式引用 LoginForm 组件，防止微信小程序的 tree-shaking 误删组件
// 使用类型断言确保组件被保留在打包中
const _LoginFormComponent: typeof LoginForm = LoginForm;

const userStore = useUserStore();

/**
 * 页面加载时检查登录状态
 */
onLoad(() => {
  // 确保 LoginForm 在运行时代码中被引用，防止小程序打包时被依赖分析误判为无引用文件而过滤
  void _LoginFormComponent;

  // 如果已登录，直接跳转到首页
  if (userStore.isLoggedIn) {
    uni.switchTab({
      url: '/pages/index/index',
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
    icon: 'none',
  });
}
</script>
<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  padding-top: calc(40px + var(--status-bar-height, 0px));
}
.login-content {
  width: 100%;
  max-width: 400px;
}
</style>
