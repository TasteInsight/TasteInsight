<template>
  <view class="identity-page page-content settings-page page-state-layout">
    <EmptyState
      v-if="!userStore.isLoggedIn"
      class="page-state-region"
      :title="t('account.profile.signInToManageYour')"
      icon="shield"
      :action-text="t('account.profile.signIn')"
      @action="login"
    />
    <template v-else>
      <text v-if="loading && !verification" class="identity-hint" role="status">{{
        t('account.profile.loadingIdentityDetails')
      }}</text>
      <view
        v-if="loadError"
        :class="{ 'page-state-region': !verification }"
        class="error-feedback"
        role="alert"
        ><text class="error-feedback__message">{{ loadError }}</text
        ><button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="load"
        >
          {{ t('account.login.reload') }}
        </button></view
      >
      <template v-if="verification">
        <view class="identity-summary">
          <view class="identity-heading"
            ><text class="identity-title">{{ t('account.profile.campusIdentity') }}</text
            ><text :class="['identity-badge', { verified: verification.canContribute }]">{{
              statusText
            }}</text></view
          >
          <text class="identity-hint">{{ statusHint }}</text>
          <text
            v-if="verification.expiresAt && verification.canContribute"
            class="identity-detail"
            >{{
              t('account.profile.validUntil', { date: verification.expiresAt.slice(0, 10) })
            }}</text
          >
          <text v-if="verification.email" class="identity-detail">{{
            t('account.profile.verifiedEmail', { email: verification.email })
          }}</text>
          <text v-if="verification.reason && !verification.canContribute" class="identity-detail">{{
            verification.reason
          }}</text>
        </view>
        <view
          v-if="!verification.canContribute && campusMethods.campusOAuth"
          class="identity-section"
        >
          <text class="settings-title identity-section-title">{{
            t('account.profile.campusSingleSignOn')
          }}</text>
          <text class="identity-hint">{{
            t('account.profile.afterAuthorizingWithYourSchool')
          }}</text>
          <button
            class="settings-button settings-button--primary"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :disabled="busy"
            @click="authorize('VERIFICATION')"
          >
            {{ t('account.profile.startVerification') }}
          </button>
        </view>
        <view
          v-if="!verification.canContribute && campusMethods.campusEmail"
          class="identity-section"
        >
          <text class="settings-title identity-section-title">{{
            t('account.profile.campusEmailVerification')
          }}</text>
          <text class="identity-hint">{{ t('account.profile.verifyYourEmailToApply') }}</text>
          <input
            v-model="email"
            class="settings-field identity-input"
            type="text"
            maxlength="254"
            :placeholder="t('account.profile.campusEmail')"
            :aria-label="t('account.profile.campusEmail')"
            :disabled="busy || emailSending"
          />
          <view class="identity-code-row">
            <input
              v-model="emailCode"
              class="settings-field identity-input"
              type="number"
              maxlength="6"
              :placeholder="t('account.login.section6DigitVerificationCode')"
              :aria-label="t('account.profile.emailVerificationCode')"
              :disabled="busy"
            />
            <button
              class="settings-button identity-link"
              hover-class="settings-button--pressed"
              :hover-stay-time="80"
              :disabled="!email.trim() || emailSending || emailRemaining > 0 || busy"
              @click="sendEmail"
            >
              {{
                emailSending
                  ? t('account.login.sending')
                  : emailRemaining
                    ? t('account.login.resendInS', { seconds: emailRemaining })
                    : t('account.login.getCode')
              }}
            </button>
          </view>
          <text v-if="emailError" class="identity-error" role="alert">{{ emailError }}</text>
          <button
            class="settings-button settings-button--primary"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :disabled="!emailCanVerify || busy"
            @click="submitEmail"
          >
            {{ t('account.profile.verifyAndSubmitApplication') }}
          </button>
        </view>
        <view v-if="hasAccountMethods" class="identity-section">
          <text class="settings-title identity-section-title">{{
            t('account.profile.signInMethods')
          }}</text>
          <view class="identity-account-list">
            <view
              v-if="configuredLogins.phone || identities?.phone"
              class="settings-row identity-account-row"
              ><text>{{ t('account.login.phoneNumber') }}</text
              ><text>{{ identities?.phone || t('account.profile.unlinked') }}</text></view
            >
            <view
              v-if="
                configuredLogins.wechatMiniapp ||
                configuredLogins.wechatApp ||
                identities?.wechat.miniapp ||
                identities?.wechat.app
              "
              class="settings-row identity-account-row"
              ><text>{{ t('account.profile.wechat') }}</text
              ><text>{{
                identities?.wechat.miniapp || identities?.wechat.app
                  ? t('account.profile.linked')
                  : t('account.profile.unlinked')
              }}</text></view
            >
            <view
              v-if="configuredLogins.campusOAuth || identities?.campusOAuth"
              class="settings-row identity-account-row"
            >
              <text>{{ t('account.profile.campusAccount') }}</text
              ><text>{{
                identities?.campusOAuth
                  ? t('account.profile.linked')
                  : t('account.profile.unlinked')
              }}</text>
            </view>
          </view>
          <button
            v-if="configuredLogins.campusOAuth && !identities?.campusOAuth"
            class="settings-button identity-link"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :disabled="busy"
            @click="authorize('LOGIN_BIND')"
          >
            {{ t('account.profile.linkCampusAccount') }}
          </button>
          <button
            v-if="configuredLogins.phone && !identities?.phone"
            class="settings-button identity-link"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            @click="showPhoneForm = !showPhoneForm"
          >
            {{
              showPhoneForm ? t('account.profile.collapse') : t('account.profile.linkPhoneNumber')
            }}
          </button>
          <view v-if="showPhoneForm && configuredLogins.phone" class="identity-binding">
            <input
              v-model="phone"
              class="settings-field identity-input"
              type="tel"
              maxlength="20"
              :placeholder="t('account.profile.phoneNumberIncludingCountryCode')"
              :aria-label="t('account.profile.linkPhoneNumber')"
              :disabled="busy || phoneSending"
            />
            <view class="identity-code-row">
              <input
                v-model="phoneCode"
                class="settings-field identity-input"
                type="number"
                maxlength="6"
                :placeholder="t('account.login.section6DigitVerificationCode')"
                :aria-label="t('account.profile.phoneLinkingVerificationCode')"
                :disabled="busy"
              />
              <button
                class="settings-button identity-link"
                hover-class="settings-button--pressed"
                :hover-stay-time="80"
                :disabled="!phone.trim() || phoneSending || phoneRemaining > 0 || busy"
                @click="sendPhone"
              >
                {{
                  phoneSending
                    ? t('account.login.sending')
                    : phoneRemaining
                      ? t('account.login.resendInS', { seconds: phoneRemaining })
                      : t('account.login.getCode')
                }}
              </button>
            </view>
            <text v-if="phoneError" class="identity-error" role="alert">{{ phoneError }}</text>
            <button
              class="settings-button settings-button--primary"
              hover-class="settings-button--pressed"
              :hover-stay-time="80"
              :disabled="!phoneCanVerify || busy"
              @click="submitPhone"
            >
              {{ t('account.profile.confirmLinking') }}
            </button>
          </view>
          <button
            v-if="canBindWechat"
            class="settings-button identity-link"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :disabled="busy"
            @click="submitWechat"
          >
            {{ t('account.profile.linkCurrentWechatAccount') }}
          </button>
        </view>
        <view v-if="pendingOAuth" class="identity-section identity-binding">
          <text class="settings-title identity-section-title">{{
            pendingOAuth.purpose === 'LOGIN_BIND'
              ? t('account.profile.linkCampusSignInMethod')
              : t('account.profile.confirmCampusIdentity')
          }}</text>
          <text class="identity-detail">{{
            t('account.profile.accountToLink', {
              nickname: pendingOAuth.account.nickname,
              suffix: pendingOAuth.account.phone ? `（${pendingOAuth.account.phone}）` : '',
            })
          }}</text>
          <text class="identity-detail identity-account-id">{{
            t('account.profile.accountId', { id: pendingOAuth.ownerId })
          }}</text>
          <text class="identity-hint">{{ t('account.profile.copyTheConfirmationCodeFrom') }}</text>
          <input
            v-model="handoffCode"
            class="settings-field identity-input"
            type="text"
            maxlength="43"
            :placeholder="t('account.profile.pasteOneTimeConfirmationCode')"
            :aria-label="
              pendingOAuth.purpose === 'LOGIN_BIND'
                ? t('account.profile.campusSignInOneTime')
                : t('account.profile.campusIdentityOneTimeConfirmation')
            "
            :disabled="busy"
          />
          <button
            class="settings-button settings-button--primary"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :disabled="busy || !validHandoffCode"
            @click="submitOAuth"
          >
            {{ t('account.profile.confirmLinkingToThisAccount') }}
          </button>
          <button
            class="settings-button identity-link"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :disabled="busy"
            @click="cancelOAuth"
          >
            {{
              pendingOAuth.purpose === 'LOGIN_BIND'
                ? t('account.profile.cancelLinking')
                : t('account.profile.cancelVerification')
            }}
          </button>
        </view>
        <text v-if="actionError" class="identity-error" role="alert">{{ actionError }}</text>
        <text class="identity-hint identity-privacy">{{
          t('account.profile.yourPhoneNumberAndVerified')
        }}</text>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { useLocalizedMessage } from '@/composables/use-localized-message';
import { t } from '@/i18n';
import EmptyState from '@/components/EmptyState.vue';
import { openLogin } from '@/utils/login-navigation';

import { computed, nextTick, ref, onScopeDispose, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { useVerificationCode } from '@/composables/use-verification-code';
import { useWechatAuthorization } from '@/composables/use-wechat-authorization';
import {
  getAuthCapabilities,
  verificationMethods,
  loginMethods,
  getStudentVerification,
  getAccountIdentities,
  sendCampusEmailCode,
  verifyCampusEmail,
  startCampusOAuth,
  startCampusLoginBinding,
  completeCampusLoginBinding,
  type CampusOAuthPurpose,
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
const verification = ref<StudentVerification | null>(null);
const capabilities = ref<AuthCapabilities | null>(null);
const configuredLogins = computed(() => loginMethods(capabilities.value));
const hasAccountMethods = computed(
  () =>
    Object.values(configuredLogins.value).some(Boolean) ||
    Boolean(
      identities.value?.phone ||
      identities.value?.campusOAuth ||
      Object.values(identities.value?.wechat ?? {}).some(Boolean)
    )
);
const campusMethods = computed(() => verificationMethods(capabilities.value));
const wechatEnabled = computed(() =>
  Boolean(
    config.platform === 'mp-weixin'
      ? configuredLogins.value.wechatMiniapp
      : configuredLogins.value.wechatApp
  )
);
const { available: wechatAvailable, authorize: authorizeWechat } =
  useWechatAuthorization(wechatEnabled);
const identities = ref<AccountIdentities | null>(null);
const loading = ref(false);
const busy = ref(false);
const loadError = useLocalizedMessage();
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
      UNVERIFIED: t('account.profile.unverified'),
      PENDING: t('account.profile.underReview'),
      VERIFIED: t('account.profile.currentStudent'),
      REJECTED: t('account.profile.unsuccessful'),
      REVOKED: t('account.profile.revoked'),
      EXPIRED: t('account.profile.expired'),
    })[verification.value?.status || 'UNVERIFIED']
);
const statusHint = computed(() =>
  verification.value?.canContribute
    ? t('account.profile.youCanPostReviewsLeave')
    : verification.value?.status === 'PENDING'
      ? t('account.profile.applicationSubmittedYouCanKeep')
      : t('account.profile.verifyYourStudentStatusTo')
);
const canBindWechat = computed(
  () =>
    wechatAvailable.value &&
    (config.platform === 'mp-weixin'
      ? configuredLogins.value.wechatMiniapp && !identities.value?.wechat.miniapp
      : ['app', 'app-plus'].includes(config.platform) &&
        configuredLogins.value.wechatApp &&
        !identities.value?.wechat.app)
);
function login() {
  openLogin();
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
      loadError.value = 'account.profile.someIdentityDetailsCouldNot';
    if (student.status === 'fulfilled') await userStore.fetchProfileAction(ownsResult);
  } catch {
    if (ownsResult()) loadError.value = 'account.profile.unableToLoadIdentityDetails';
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
      actionError.value =
        cause instanceof Error ? cause.message : t('account.profile.somethingWentWrongTryAgain');
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
    const {
      attemptId,
      handoffCode: code,
      purpose,
    } = campusOAuthCompletion(userStore.userInfo?.id, handoffCode.value);
    if (purpose === 'LOGIN_BIND') await completeCampusLoginBinding(attemptId, code);
    else await completeCampusOAuth(attemptId, code);
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
function authorize(purpose: CampusOAuthPurpose) {
  return perform(async isCurrent => {
    const owner = userStore.userInfo?.id;
    if (!owner) throw new Error(t('account.profile.signInBeforeStartingCampus2'));
    cancelOAuth();
    // #ifdef MP-WEIXIN
    if (config.platform === 'mp-weixin') {
      uni.navigateTo({
        url:
          purpose === 'LOGIN_BIND'
            ? '/pages/profile/campus-auth?purpose=LOGIN_BIND'
            : '/pages/profile/campus-auth',
      });
      return;
    }
    // #endif
    // #ifndef MP-WEIXIN
    // #ifdef H5
    const openedPopup = window.open('about:blank', '_blank');
    popup = openedPopup;
    // #endif
    try {
      const result = await (purpose === 'LOGIN_BIND'
        ? startCampusLoginBinding()
        : startCampusOAuth());
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
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
.identity-heading,
.identity-account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.identity-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
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
  gap: 12px;
  padding: 24px 0;
  border-top: 1px solid #eaecf0;
}
.identity-section-title {
  margin-bottom: 0;
}
.identity-hint,
.identity-detail {
  display: block;
  font-size: 13px;
  color: #667085;
  line-height: 1.6;
}
.identity-detail {
  font-size: 13px;
}
.identity-account-id {
  overflow-wrap: anywhere;
}
.identity-input {
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
.identity-link {
  justify-content: flex-start;
  border-color: transparent;
  background: transparent;
  color: #660874;
  text-align: left;
}
.identity-link[disabled] {
  border-color: transparent;
  background: transparent;
}
.identity-code-row > .identity-link {
  flex-shrink: 0;
}
.identity-account-row {
  font-size: 16px;
  overflow-wrap: anywhere;
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
</style>
