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
      <view v-if="capabilities?.phone" class="phone-login">
        <label class="login-label" for="login-phone">手机号</label>
        <input id="login-phone" v-model="phone" class="login-input" type="tel" maxlength="20" placeholder="输入手机号，可含国际区号" :disabled="loading || submitted || sending" />
        <view class="code-row">
          <input v-model="code" class="login-input code-input" type="number" maxlength="6" placeholder="6 位验证码" :disabled="loading || submitted" aria-label="短信验证码" />
          <button class="code-send" :disabled="!phone.trim() || sending || remaining > 0 || loading || submitted" @click="handleSendCode">{{ sending ? '发送中' : remaining > 0 ? `${remaining}s 后重发` : '获取验证码' }}</button>
        </view>
        <text v-if="codeError" class="login-error" role="alert">{{ codeError }}</text>
        <button class="login-button" :disabled="!canVerify || loading || submitted" @click="handleLogin(() => phoneLogin(challengeId, code))">{{ loading ? '正在登录…' : '验证码登录' }}</button>
      </view>
      <text v-if="capabilitiesLoading" class="login-test-note" role="status">正在读取登录方式…</text>
      <button v-if="capabilitiesError" class="login-secondary" @click="loadCapabilities">登录方式加载失败，点击重试</button>
      <!-- 微信一键登录按钮 -->
      <button
        v-if="wechatAvailable && canUseWechat"
        class="login-button"
        :disabled="loading || submitted"
        @click="handleWechatLogin"
        hover-class="none"
      >
        <text>{{ submitted ? '登录成功' : loading ? '正在登录…' : '微信一键登录' }}</text>
      </button>
      <template v-if="testLoginEnabled">
        <text class="login-environment">开发环境</text>
        <button class="login-button" :disabled="loading || submitted" @click="handleTestLogin">
          {{ submitted ? '登录成功' : loading ? '正在登录…' : '开发测试登录' }}
        </button>
        <text class="login-test-note">使用当前设备的测试账号</text>
      </template>
      <button class="login-secondary" @click="browse">先逛逛</button>
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
import { ref, computed, onMounted, onScopeDispose } from 'vue';
import { useLogin } from '../composables/use-login';
import config from '@/config';
import { getAuthCapabilities, sendPhoneCode, type AuthCapabilities } from '@/api/modules/auth';
import { useVerificationCode } from '@/composables/use-verification-code';

const { loading, submitted, wechatAvailable, wechatLogin, phoneLogin, testLogin, testLoginEnabled } =
  useLogin();
const agreed = ref(false);
const capabilities = ref<AuthCapabilities | null>(null);
const capabilitiesLoading = ref(true);
const capabilitiesError = ref(false);
let disposed = false;
onScopeDispose(() => { disposed = true; });
const canUseWechat = computed(() => config.platform === 'mp-weixin' ? capabilities.value?.wechatMiniapp : capabilities.value?.wechatApp);
const { target: phone, code, challengeId, sending, remaining, canVerify, error: codeError, sendCode } = useVerificationCode(sendPhoneCode);
async function loadCapabilities() {
  capabilitiesLoading.value = true;
  capabilitiesError.value = false;
  try {
    const result = await getAuthCapabilities();
    if (!disposed) capabilities.value = result.data;
  } catch {
    if (!disposed) capabilitiesError.value = true;
  } finally { if (!disposed) capabilitiesLoading.value = false; }
}
onMounted(loadCapabilities);
function handleSendCode() {
  if (!agreed.value) return uni.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' });
  void sendCode();
}
function browse() { uni.switchTab({ url: '/pages/index/index' }); }

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
.phone-login { display: flex; flex-direction: column; gap: 12px; }
.login-label { font-size: 14px; font-weight: 600; color: #344054; }
.login-input { box-sizing: border-box; height: 48px; padding: 0 14px; background: #f5f5f6; border-radius: 10px; color: #1f2937; font-size: 15px; caret-color: #660874; }
.code-row { display: flex; gap: 8px; align-items: center; }
.code-input { min-width: 0; flex: 1; }
.code-send, .login-secondary { margin: 0; padding: 12px; border: 0; background: transparent; color: #660874; font-size: 14px; line-height: 24px; }
.code-send::after, .login-secondary::after { border: 0; }
.code-send[disabled] { color: #667085; background: transparent; }
.login-error { color: #b42318; font-size: 13px; line-height: 1.5; }
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
