<template>
  <view class="identity-page">
    <view v-if="!userStore.isLoggedIn" class="identity-empty">
      <text>登录后管理账号与校园身份</text>
      <button class="identity-primary" @click="login">去登录</button>
    </view>
    <template v-else>
      <text v-if="loading && !verification" class="identity-hint" role="status"
        >正在读取身份信息…</text
      >
      <view v-if="loadError" class="error-feedback" role="alert"
        ><text class="error-feedback__message">{{ loadError }}</text
        ><button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="load"
        >
          重新加载
        </button></view
      >
      <template v-if="verification">
        <view class="identity-summary">
          <view class="identity-heading"
            ><text class="identity-title">校园身份</text
            ><text :class="['identity-badge', { verified: verification.canContribute }]">{{
              statusText
            }}</text></view
          >
          <text class="identity-hint">{{ statusHint }}</text>
          <text v-if="verification.expiresAt && verification.canContribute" class="identity-detail"
            >有效期至 {{ verification.expiresAt.slice(0, 10) }}</text
          >
          <text v-if="verification.email" class="identity-detail"
            >认证邮箱 {{ verification.email }}</text
          >
          <text v-if="verification.reason && !verification.canContribute" class="identity-detail">{{
            verification.reason
          }}</text>
        </view>
        <view
          v-if="!verification.canContribute && capabilities?.campusOAuth"
          class="identity-section"
        >
          <text class="identity-section-title">校园统一认证</text>
          <text class="identity-hint">完成校方授权后，返回这里确认绑定。</text>
          <button class="identity-primary" :disabled="busy" @click="authorize">前往认证</button>
          <view v-if="pendingOAuth" class="identity-binding">
            <text class="identity-detail"
              >绑定账号 {{ pendingOAuth.account.nickname
              }}{{ pendingOAuth.account.phone ? `（${pendingOAuth.account.phone}）` : '' }}</text
            >
            <text class="identity-detail identity-account-id"
              >账号 ID：{{ pendingOAuth.ownerId }}</text
            >
            <text class="identity-hint"
              >从认证完成页面复制确认码，在 3 分钟内粘贴并确认。请勿使用他人提供的确认码。</text
            >
            <input
              v-model="handoffCode"
              class="identity-input"
              type="text"
              maxlength="43"
              placeholder="粘贴一次性确认码"
              aria-label="校园身份一次性确认码"
              :disabled="busy"
            />
            <button
              class="identity-primary"
              :disabled="busy || !validHandoffCode"
              @click="submitOAuth"
            >
              确认绑定到当前账号
            </button>
            <button class="identity-link" :disabled="busy" @click="cancelOAuth">
              取消本次认证
            </button>
          </view>
        </view>
        <view
          v-if="!verification.canContribute && capabilities?.campusEmail"
          class="identity-section"
        >
          <text class="identity-section-title">校园邮箱验证</text>
          <text class="identity-hint">验证邮箱后提交学生资格申请，审核结果在此查看。</text>
          <input
            v-model="email"
            class="identity-input"
            type="text"
            maxlength="254"
            placeholder="校园邮箱"
            aria-label="校园邮箱"
            :disabled="busy || emailSending"
          />
          <view class="identity-code-row">
            <input
              v-model="emailCode"
              class="identity-input"
              type="number"
              maxlength="6"
              placeholder="6 位验证码"
              aria-label="邮箱验证码"
              :disabled="busy"
            />
            <button
              class="identity-link"
              :disabled="!email.trim() || emailSending || emailRemaining > 0 || busy"
              @click="sendEmail"
            >
              {{
                emailSending
                  ? '发送中'
                  : emailRemaining
                    ? `${emailRemaining}s 后重发`
                    : '获取验证码'
              }}
            </button>
          </view>
          <text v-if="emailError" class="identity-error" role="alert">{{ emailError }}</text>
          <button class="identity-primary" :disabled="!emailCanVerify || busy" @click="submitEmail">
            验证并提交申请
          </button>
        </view>
        <view class="identity-section">
          <text class="identity-section-title">登录方式</text>
          <view class="identity-account-row"
            ><text>手机号</text><text>{{ identities?.phone || '未绑定' }}</text></view
          >
          <view class="identity-account-row"
            ><text>微信</text
            ><text>{{
              identities?.wechat.miniapp || identities?.wechat.app ? '已绑定' : '未绑定'
            }}</text></view
          >
          <button
            v-if="capabilities?.phone && !identities?.phone"
            class="identity-link"
            @click="showPhoneForm = !showPhoneForm"
          >
            {{ showPhoneForm ? '收起' : '绑定手机号' }}
          </button>
          <view v-if="showPhoneForm" class="identity-binding">
            <input
              v-model="phone"
              class="identity-input"
              type="tel"
              maxlength="20"
              placeholder="手机号，可含国际区号"
              aria-label="绑定手机号"
              :disabled="busy || phoneSending"
            />
            <view class="identity-code-row">
              <input
                v-model="phoneCode"
                class="identity-input"
                type="number"
                maxlength="6"
                placeholder="6 位验证码"
                aria-label="绑定手机验证码"
                :disabled="busy"
              />
              <button
                class="identity-link"
                :disabled="!phone.trim() || phoneSending || phoneRemaining > 0 || busy"
                @click="sendPhone"
              >
                {{
                  phoneSending
                    ? '发送中'
                    : phoneRemaining
                      ? `${phoneRemaining}s 后重发`
                      : '获取验证码'
                }}
              </button>
            </view>
            <text v-if="phoneError" class="identity-error" role="alert">{{ phoneError }}</text>
            <button
              class="identity-primary"
              :disabled="!phoneCanVerify || busy"
              @click="submitPhone"
            >
              确认绑定
            </button>
          </view>
          <button v-if="canBindWechat" class="identity-link" :disabled="busy" @click="submitWechat">
            绑定当前微信
          </button>
        </view>
        <text v-if="actionError" class="identity-error" role="alert">{{ actionError }}</text>
        <text class="identity-hint identity-privacy">手机号与认证邮箱不会展示在公开主页。</text>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onScopeDispose, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { useVerificationCode } from '@/composables/use-verification-code';
import { useWechatAuthorization } from '@/composables/use-wechat-authorization';
import {
  getAuthCapabilities,
  getStudentVerification,
  getAccountIdentities,
  sendCampusEmailCode,
  verifyCampusEmail,
  startCampusOAuth,
  completeCampusOAuth,
  sendBindingPhoneCode,
  bindPhone,
  bindWechat,
  type AuthCapabilities,
  type StudentVerification,
  type AccountIdentities,
} from '@/api/modules/auth';
import {
  saveCampusOAuthPending,
  readCampusOAuthPending,
  clearCampusOAuthPending,
  campusOAuthCompletion,
  campusOAuthMessage,
  type PendingCampusOAuth,
} from '@/utils/campus-oauth';

const userStore = useUserStore();
const { available: wechatAvailable, authorize: authorizeWechat } = useWechatAuthorization();
const verification = ref<StudentVerification | null>(null);
const capabilities = ref<AuthCapabilities | null>(null);
const identities = ref<AccountIdentities | null>(null);
const loading = ref(false);
const busy = ref(false);
const loadError = ref('');
const actionError = ref('');
const showPhoneForm = ref(false);
const pendingOAuth = ref<PendingCampusOAuth | null>(null);
const handoffCode = ref('');
const validHandoffCode = computed(() => /^[A-Za-z0-9_-]{43}$/.test(handoffCode.value.trim()));
let popup: Window | null = null;
let disposed = false;
let loadVersion = 0;
onScopeDispose(() => {
  disposed = true;
  loadVersion++;
  // #ifdef H5
  window.removeEventListener('message', receiveOAuth);
  popup?.close();
  // #endif
});
watch(
  [() => userStore.sessionVersion, () => userStore.userInfo?.id],
  ([session, owner]) => {
    loadVersion++;
    verification.value = null;
    identities.value = null;
    capabilities.value = null;
    loading.value = false;
    loadError.value = '';
    actionError.value = '';
    showPhoneForm.value = false;
    pendingOAuth.value = null;
    handoffCode.value = '';
    busy.value = false;
    // #ifdef H5
    popup?.close();
    popup = null;
    // #endif
    void nextTick(() => {
      if (
        !disposed &&
        userStore.isLoggedIn &&
        session === userStore.sessionVersion &&
        owner === userStore.userInfo?.id
      )
        void load();
    });
  },
  { flush: 'sync' }
);
const {
  target: email,
  code: emailCode,
  challengeId: emailChallenge,
  sending: emailSending,
  remaining: emailRemaining,
  canVerify: emailCanVerify,
  error: emailError,
  sendCode: sendEmail,
} = useVerificationCode(sendCampusEmailCode);
const {
  target: phone,
  code: phoneCode,
  challengeId: phoneChallenge,
  sending: phoneSending,
  remaining: phoneRemaining,
  canVerify: phoneCanVerify,
  error: phoneError,
  sendCode: sendPhone,
} = useVerificationCode(sendBindingPhoneCode);
const statusText = computed(
  () =>
    ({
      UNVERIFIED: '未认证',
      PENDING: '审核中',
      VERIFIED: '在校学生',
      REJECTED: '未通过',
      REVOKED: '已失效',
      EXPIRED: '已过期',
    })[verification.value?.status || 'UNVERIFIED']
);
const statusHint = computed(() =>
  verification.value?.canContribute
    ? '可以参与评价、留言和校园交流。'
    : verification.value?.status === 'PENDING'
      ? '申请已提交，仍可继续浏览和使用个人计划。'
      : '完成学生认证后，可以发布评价和参与校园交流。'
);
const canBindWechat = computed(
  () =>
    wechatAvailable.value &&
    (config.platform === 'mp-weixin'
      ? capabilities.value?.wechatMiniapp && !identities.value?.wechat.miniapp
      : ['app', 'app-plus'].includes(config.platform) &&
        capabilities.value?.wechatApp &&
        !identities.value?.wechat.app)
);
function login() {
  uni.navigateTo({ url: '/pages/login/index' });
}
async function load() {
  pendingOAuth.value = readCampusOAuthPending(userStore.userInfo?.id);
  if (!userStore.isLoggedIn) {
    verification.value = null;
    return;
  }
  const session = userStore.sessionVersion;
  const owner = userStore.userInfo?.id;
  const version = ++loadVersion;
  const ownsResult = () =>
    !disposed &&
    session === userStore.sessionVersion &&
    owner === userStore.userInfo?.id &&
    version === loadVersion;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await Promise.allSettled([
      getStudentVerification(),
      getAuthCapabilities(),
      getAccountIdentities(),
    ]);
    if (!ownsResult()) return;
    const [student, methods, accounts] = result;
    if (student.status === 'fulfilled') verification.value = student.value.data;
    if (methods.status === 'fulfilled') capabilities.value = methods.value.data;
    if (accounts.status === 'fulfilled') identities.value = accounts.value.data;
    if (result.some(item => item.status === 'rejected'))
      loadError.value = '部分身份信息读取失败，请重试';
    if (student.status === 'fulfilled') await userStore.fetchProfileAction(ownsResult);
  } catch {
    if (ownsResult()) loadError.value = '身份信息读取失败，请重试';
  } finally {
    if (ownsResult()) loading.value = false;
  }
}
onShow(load);
async function perform(action: (isCurrent: () => boolean) => Promise<unknown>, refresh = true) {
  if (busy.value) return;
  const session = userStore.sessionVersion;
  const owner = userStore.userInfo?.id;
  const isCurrent = () =>
    !disposed && session === userStore.sessionVersion && owner === userStore.userInfo?.id;
  busy.value = true;
  actionError.value = '';
  try {
    await action(isCurrent);
    if (refresh && isCurrent()) await load();
  } catch (cause) {
    if (isCurrent())
      actionError.value = cause instanceof Error ? cause.message : '操作失败，请重试';
  } finally {
    if (isCurrent()) busy.value = false;
  }
}
function submitEmail() {
  return perform(async isCurrent => {
    await verifyCampusEmail(emailChallenge.value, emailCode.value);
    if (isCurrent()) {
      email.value = '';
      emailCode.value = '';
      emailChallenge.value = '';
    }
  });
}
function submitPhone() {
  return perform(async isCurrent => {
    await bindPhone(phoneChallenge.value, phoneCode.value);
    if (isCurrent()) {
      showPhoneForm.value = false;
      phone.value = '';
      phoneCode.value = '';
      phoneChallenge.value = '';
    }
  });
}
function cancelOAuth() {
  clearCampusOAuthPending();
  pendingOAuth.value = null;
  handoffCode.value = '';
  // #ifdef H5
  popup?.close();
  popup = null;
  // #endif
}
function submitOAuth() {
  return perform(async isCurrent => {
    const { attemptId, handoffCode: code } = campusOAuthCompletion(
      userStore.userInfo?.id,
      handoffCode.value
    );
    await completeCampusOAuth(attemptId, code);
    if (isCurrent()) cancelOAuth();
  });
}
function receiveOAuth(event: MessageEvent) {
  // #ifdef H5
  const code = campusOAuthMessage(
    event,
    popup,
    new URL(config.baseUrl, window.location.href).origin,
    userStore.userInfo?.id
  );
  if (code) {
    pendingOAuth.value = readCampusOAuthPending(userStore.userInfo?.id);
    handoffCode.value = code;
  }
  // #endif
}
// #ifdef H5
window.addEventListener('message', receiveOAuth);
// #endif
function submitWechat() {
  return perform(async isCurrent => {
    const code = await authorizeWechat();
    if (!isCurrent()) return;
    return bindWechat(code, config.platform === 'mp-weixin' ? 'mp-weixin' : 'app');
  });
}
function authorize() {
  return perform(async isCurrent => {
    const owner = userStore.userInfo?.id;
    if (!owner) throw new Error('请先登录，再发起校园认证');
    cancelOAuth();
    // #ifdef MP-WEIXIN
    if (config.platform === 'mp-weixin') {
      uni.navigateTo({ url: '/pages/profile/campus-auth' });
      return;
    }
    // #endif
    // #ifndef MP-WEIXIN
    // #ifdef H5
    const openedPopup = window.open('about:blank', '_blank');
    popup = openedPopup;
    // #endif
    try {
      const result = await startCampusOAuth();
      if (!isCurrent()) {
        // #ifdef H5
        openedPopup?.close();
        // #endif
        return;
      }
      pendingOAuth.value = saveCampusOAuthPending(owner, result.data);
      // #ifdef H5
      if (openedPopup) openedPopup.location.replace(result.data.authorizationUrl);
      else window.location.assign(result.data.authorizationUrl);
      // #endif
      // #ifdef APP-PLUS
      plus.runtime.openURL(result.data.authorizationUrl);
      // #endif
    } catch (error) {
      // #ifdef H5
      openedPopup?.close();
      // #endif
      throw error;
    }
    // #endif
  }, false);
}
</script>

<style scoped>
.identity-page {
  max-width: 620px;
  box-sizing: border-box;
  padding: 24px 20px 40px;
  margin: 0 auto;
  color: #1f2937;
  background: #fff;
}
.identity-heading,
.identity-account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.identity-title {
  font-size: 23px;
  font-weight: 650;
}
.identity-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}
.identity-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #475467;
  background: #f2f4f7;
}
.identity-badge.verified {
  color: #166534;
  background: #ecfdf3;
}
.identity-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px 0;
  border-top: 1px solid #eaecf0;
}
.identity-section-title {
  font-size: 17px;
  font-weight: 600;
}
.identity-hint,
.identity-detail {
  display: block;
  font-size: 14px;
  color: #667085;
  line-height: 1.65;
}
.identity-detail {
  font-size: 13px;
}
.identity-account-id {
  overflow-wrap: anywhere;
}
.identity-input {
  box-sizing: border-box;
  height: 48px;
  padding: 0 14px;
  border-radius: 10px;
  background: #f5f5f6;
  font-size: 15px;
  caret-color: #660874;
}
.identity-code-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.identity-code-row .identity-input {
  flex: 1;
  min-width: 0;
}
.identity-primary {
  margin: 0;
  padding: 12px 18px;
  min-height: 46px;
  border-radius: 10px;
  background: #660874;
  color: #fff;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
}
.identity-primary[disabled] {
  color: #667085;
  background: #eaecf0;
}
.identity-primary::after,
.identity-link::after {
  border: 0;
}
.identity-link {
  margin: 0;
  padding: 10px 4px;
  min-height: 44px;
  background: transparent;
  color: #660874;
  font-size: 14px;
  line-height: 24px;
  text-align: left;
}
.identity-link[disabled] {
  background: transparent;
  color: #667085;
}
.identity-account-row {
  font-size: 15px;
  min-height: 36px;
}
.identity-binding {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.identity-error {
  display: block;
  color: #b42318;
  font-size: 14px;
  line-height: 1.6;
}
.identity-privacy {
  padding-top: 16px;
  border-top: 1px solid #eaecf0;
}
.identity-empty {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 48px 0;
}
button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
}
</style>
