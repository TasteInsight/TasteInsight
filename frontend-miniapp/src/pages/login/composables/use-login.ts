import { ref, getCurrentScope, onScopeDispose, type Ref } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import type { CampusLoginTicket } from '@/api/modules/auth';
import config from '@/config';
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
  let navigation: ReturnType<typeof setTimeout> | undefined;

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      if (navigation) clearTimeout(navigation);
    });

  /**
   * 执行授权和登录，防止过期会话应用授权结果
   */
  async function authenticate(
    getCode: () => Promise<string>,
    consume: (code: string) => Promise<unknown> = code => userStore.loginAction(code)
  ): Promise<void> {
    if (loading.value || submitted.value || disposed) return;

    loading.value = true;
    const initialSession = userStore.sessionVersion;
    const initialOwner = userStore.userInfo?.id;

    try {
      const code = await getCode();
      if (
        disposed ||
        userStore.sessionVersion !== initialSession ||
        userStore.userInfo?.id !== initialOwner
      )
        return;
      await consume(code);
      if (disposed) return;
      const loggedInSession = userStore.sessionVersion;
      submitted.value = true;

      uni.showToast({
        title: '登录成功',
        icon: 'success',
      });

      // 3. 登录成功后跳转到首页
      navigation = setTimeout(() => {
        if (!disposed && userStore.sessionVersion === loggedInSession)
          uni.switchTab({ url: '/pages/index/index' });
      }, 500);
    } catch (error: any) {
      let errorMessage = '登录失败，请重试';
      if (error?.errMsg?.includes('login:fail')) {
        errorMessage = '微信授权未完成，请重试';
      }

      if (!disposed)
        uni.showToast({
          title: errorMessage,
          icon: 'none',
        });

      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function wechatLogin(): Promise<void> {
    if (!wechatAvailable.value) throw new Error('当前平台未配置微信登录');
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
    if (!config.testLoginEnabled) throw new Error('开发测试登录未启用');
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
