import { t } from '@/i18n';
import { ref, getCurrentScope, onScopeDispose, type Ref } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import type { CampusLoginTicket } from '@/api/modules/auth';
import config from '@/config';
import { returnFromLogin } from '@/utils/login-navigation';
import { useWechatAuthorization } from '@/composables/use-wechat-authorization';

export function useLogin(wechatEnabled?: Ref<boolean>) {
  const loading = ref(false);
  const submitted = ref(false);
  const {
    available: wechatAvailable,
    checking: wechatProviderLoading,
    authorize: authorizeWechat,
  } = useWechatAuthorization(wechatEnabled);
  const userStore = useUserStore();
  let disposed = false;
  let operation = 0;
  let exchangeSession: number | undefined;
  function cancel() {
    operation++;
    if (
      loading.value &&
      !submitted.value &&
      exchangeSession !== undefined &&
      userStore.sessionVersion === exchangeSession
    )
      userStore.logoutAction();
    exchangeSession = undefined;
    loading.value = false;
  }

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      cancel();
    });

  /**
   * 执行授权和登录，防止过期会话应用授权结果
   */
  async function authenticate(
    getCode: () => Promise<string>,
    consume: (code: string) => Promise<unknown> = code => userStore.loginAction(code)
  ): Promise<void> {
    if (loading.value || submitted.value || disposed) return;

    const attempt = ++operation;
    const current = () => !disposed && attempt === operation;
    loading.value = true;
    const initialSession = userStore.sessionVersion;
    const initialOwner = userStore.userInfo?.id;

    try {
      const code = await getCode();
      if (
        !current() ||
        userStore.sessionVersion !== initialSession ||
        userStore.userInfo?.id !== initialOwner
      )
        return;
      const exchange = consume(code);
      exchangeSession = userStore.sessionVersion;
      await exchange;
      if (!current()) return;
      submitted.value = true;

      uni.showToast({
        title: t('account.login.signedIn'),
        icon: 'success',
      });

      returnFromLogin();
    } catch (error: any) {
      if (
        !current() ||
        (exchangeSession !== undefined &&
          userStore.sessionVersion !== exchangeSession &&
          userStore.isLoggedIn)
      )
        return;
      let errorMessage = t('account.login.signInFailedTryAgain');
      if (error?.errMsg?.includes('login:fail')) {
        errorMessage = t('account.login.wechatAuthorizationWasIncompleteTry');
      }

      if (!disposed)
        uni.showToast({
          title: errorMessage,
          icon: 'none',
        });

      throw error;
    } finally {
      if (current()) {
        loading.value = false;
        exchangeSession = undefined;
      }
    }
  }

  async function wechatLogin(): Promise<void> {
    if (!wechatAvailable.value) throw new Error(t('account.login.wechatSignInIsUnavailable'));
    return authenticate(authorizeWechat, code =>
      config.platform === 'mp-weixin'
        ? userStore.loginAction(code)
        : userStore.loginAction(code, 'app')
    );
  }

  const phoneLogin = (challengeId: string, code: string) =>
    authenticate(
      async () => code,
      value => userStore.phoneLoginAction(challengeId, value)
    );

  const campusLogin = (ticket: CampusLoginTicket) =>
    authenticate(
      async () => ticket.handoffCode,
      () => userStore.campusLoginAction(ticket)
    );

  async function testLogin(): Promise<void> {
    if (!config.testLoginEnabled) throw new Error(t('account.login.developmentTestSignInIs'));
    return authenticate(async () => {
      let identity = uni.getStorageSync('development-login-identity');
      if (!identity) {
        identity = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
        uni.setStorageSync('development-login-identity', identity);
      }
      return `mock_${identity}`;
    });
  }

  return {
    cancel,
    loading,
    submitted,
    wechatAvailable,
    wechatProviderLoading,
    testLogin,
    testLoginEnabled: config.testLoginEnabled,
    wechatLogin,
    phoneLogin,
    campusLogin,
  };
}
