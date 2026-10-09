<template>
  <view class="login-form">
    <!-- Logo 区域 -->
    <view class="login-brand">
      <image src="/static/logo.png" class="login-logo" mode="aspectFit" />
      <text class="login-title">TasteInsight</text>
      <text class="login-description">发现身边的美食</text>
    </view>

    <!-- 登录操作区域 -->
    <view class="login-actions">
      <!-- 微信一键登录按钮 -->
      <button
        v-if="wechatAvailable"
        class="login-button"
        :disabled="loading || submitted"
        @click="handleWechatLogin"
        hover-class="none"
      >
        <text>{{ submitted ? '登录成功' : loading ? '正在登录…' : '微信一键登录' }}</text>
      </button>
      <view v-else class="login-platform-note" role="status">{{ platformNotice }}</view>
      <template v-if="testLoginEnabled">
        <text class="login-environment">开发环境</text>
        <button class="login-button" :disabled="loading || submitted" @click="handleTestLogin">
          {{ submitted ? '登录成功' : loading ? '正在登录…' : '开发测试登录' }}
        </button>
        <text class="login-test-note">使用当前设备的测试账号</text>
      </template>
    </view>

    <!-- 底部协议 -->
    <view class="login-agreement">
      <view class="agreement-row">
        <checkbox-group @change="handleAgreementChange">
          <label class="agreement-toggle">
            <checkbox value="agreed" :checked="agreed" color="#660874" />
            <text>我已同意</text>
          </label>
        </checkbox-group>
        <text class="agreement-link" @click="openAgreement('user')">《用户协议》</text>
        <text>和</text>
        <text class="agreement-link" @click="openAgreement('privacy')">《隐私政策》</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useLogin } from '../composables/use-login';
import config from '@/config';

const { loading, submitted, wechatAvailable, wechatLogin, testLogin, testLoginEnabled } =
  useLogin();
const platformNotice =
  config.platform === 'h5'
    ? '请在微信小程序中使用微信登录。'
    : '当前应用尚未接入微信登录，请使用微信小程序。';
const agreed = ref(false);

const emit = defineEmits<{
  loginSuccess: [];
}>();

/**
 * 同步协议选择状态
 */
function handleAgreementChange(event: { detail: { value: string[] } }) {
  agreed.value = event.detail.value.includes('agreed');
}

/**
 * 处理微信登录
 */
async function handleWechatLogin() {
  await handleLogin(wechatLogin);
}
async function handleTestLogin() {
  await handleLogin(testLogin);
}
async function handleLogin(login: () => Promise<void>) {
  try {
    if (!agreed.value) {
      uni.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' });
      return;
    }
    await login();
    emit('loginSuccess');
  } catch (error) {
    console.error('登录失败:', error);
  }
}

/**
 * 打开协议
 */
function openAgreement(type: 'user' | 'privacy') {
  const url =
    type === 'user' ? '/pages/settings/privacy?type=user' : '/pages/settings/privacy?type=privacy';
  uni.navigateTo({ url });
}
</script>

<style scoped>
.login-form {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}
.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48px;
}
.login-logo {
  width: 72px;
  height: 72px;
  margin-bottom: 20px;
}
.login-title {
  color: #1f2937;
  font-size: 28px;
  font-weight: 650;
  line-height: 1.3;
}
.login-description {
  margin-top: 10px;
  color: #667085;
  font-size: 15px;
}
.login-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 50px;
  margin: 0;
  padding: 12px 20px;
  border: 0;
  border-radius: 12px;
  background: #660874;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}
.login-button::after {
  border: 0;
}
.login-button[disabled] {
  background: #eaecf0;
  color: #667085;
}
.login-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
}
.login-platform-note {
  padding: 16px;
  border-radius: 12px;
  background: #f4f4f5;
  color: #475467;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}
.login-environment {
  margin-top: 8px;
  color: #667085;
  font-size: 12px;
  text-align: center;
}
.login-test-note {
  color: #667085;
  font-size: 13px;
  text-align: center;
}
.login-agreement {
  margin-top: 24px;
}
.agreement-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #667085;
  font-size: 13px;
}

.agreement-toggle {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  gap: 6px;
}

.agreement-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: #660874;
}
</style>
