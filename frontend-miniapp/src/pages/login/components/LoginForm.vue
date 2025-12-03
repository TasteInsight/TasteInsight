<template>
  <view class="w-full flex flex-col items-center">
    <!-- Logo 区域 -->
    <view class="flex flex-col items-center mb-16 animate-fade-in-down">
      <view class="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-6 border border-purple-50">
        <image src="/static/logo.png" class="w-16 h-16" mode="aspectFit" />
      </view>
      <text class="text-2xl font-bold text-gray-800 tracking-wide">TasteInsight</text>
      <text class="text-sm text-gray-500 mt-2 tracking-widest uppercase">发现身边的美食</text>
    </view>

    <!-- 登录操作区域 -->
    <view class="w-full space-y-6 animate-fade-in-up">
      <!-- 微信一键登录按钮 -->
      <button
        class="w-full bg-ts-purple text-white py-4 rounded-full font-bold text-lg shadow-lg shadow-purple-200 active:scale-[0.98] active:shadow-md transition-all duration-200 flex items-center justify-center border-none"
        :disabled="loading"
        @click="handleWechatLogin"
        hover-class="none"
      >
        <text v-if="!loading" class="iconify mr-2 text-xl" data-icon="ri:wechat-fill"></text>
        <text>{{ loading ? '正在登录...' : '微信一键登录' }}</text>
      </button>
      
      
    </view>

    <!-- 底部协议 -->
    <view class="mt-12 text-center animate-fade-in">
      <view class="flex items-center justify-center space-x-1 text-xs text-gray-400">
        <text>登录即代表同意</text>
        <text class="text-ts-purple font-medium" @click="openAgreement('user')">《用户协议》</text>
        <text>和</text>
        <text class="text-ts-purple font-medium" @click="openAgreement('privacy')">《隐私政策》</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useLogin } from '../composables/use-login';

const { loading, wechatLogin } = useLogin();

const emit = defineEmits<{
  loginSuccess: [];
}>();

/**
 * 处理微信登录
 */
async function handleWechatLogin() {
  try {
    await wechatLogin();
    emit('loginSuccess');
  } catch (error) {
    console.error('登录失败:', error);
  }
}



/**
 * 打开协议
 */
function openAgreement(type: 'user' | 'privacy') {
  const url = type === 'user' ? '/pages/settings/privacy?type=user' : '/pages/settings/privacy?type=privacy';
  uni.navigateTo({ url });
}
</script>

<style scoped>
.animate-fade-in-down {
  animation: fadeInDown 0.8s ease-out;
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out 0.2s backwards;
}

.animate-fade-in {
  animation: fadeIn 1s ease-out 0.5s backwards;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>