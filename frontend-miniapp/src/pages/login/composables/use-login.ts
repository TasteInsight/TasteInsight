import { ref, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import config from '@/config';

export function useLogin() {
  const loading = ref(false);
  const submitted = ref(false);
  const wechatAvailable = ref(config.platform === 'mp-weixin');
  const userStore = useUserStore();
  let disposed = false;
  let navigation: ReturnType<typeof setTimeout> | undefined;

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      if (navigation) clearTimeout(navigation);
    });

  /**
   * 微信登录流程
   */
  async function authenticate(getCode: () => Promise<string>): Promise<void> {
    if (loading.value || submitted.value || disposed) return;

    loading.value = true;
    const initialSession = userStore.sessionVersion;

    try {
      const code = await getCode();
      if (disposed || userStore.sessionVersion !== initialSession) return;
      await userStore.loginAction(code);
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
    return authenticate(
      () =>
        new Promise((resolve, reject) =>
          uni.login({
            provider: 'weixin',
            success: result => resolve(result.code),
            fail: reject,
          })
        )
    );
  }

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
    testLogin,
    testLoginEnabled: config.testLoginEnabled,
    wechatLogin,
  };
}
