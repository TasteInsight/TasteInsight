<template>
  <view class="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
    <!-- 标题 -->
    <view class="text-center mb-8">
      <text class="text-3xl font-bold text-gray-800">欢迎登录</text>
      <text class="block mt-2 text-gray-600">TasteInsight 美食推荐</text>
    </view>

    <!-- 登录按钮 -->
    <view class="space-y-6">
      <!-- 微信登录按钮 -->
      <button
        class="w-full bg-white text-ts-purple border-2 border-ts-purple py-3 px-4 rounded-xl font-semibold flex items-center justify-center shadow-md hover:shadow-lg active:shadow-sm transition-all duration-300 hover:bg-purple-50 active:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="loading"
        @click="handleWechatLogin"
      >
        <text class="iconify mr-2" data-icon="mdi:wechat" data-width="24"></text>
        <text>{{ loading ? '登录中...' : '微信一键登录' }}</text>
      </button>
    </view>

    <!-- 协议说明 -->
    <view class="mt-6 text-center">
      <text class="text-xs text-gray-500">
        登录即代表同意
        <text class="text-purple-600">《用户协议》</text>
        和
        <text class="text-purple-600">《隐私政策》</text>
      </text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="mt-4 text-center">
      <text class="text-purple-600 text-sm">正在获取登录信息...</text>
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
</script>