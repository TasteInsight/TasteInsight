import { ref } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';

export function useLogin() {
  const loading = ref(false);
  const userStore = useUserStore();

  /**
   * 微信登录流程
   */
  async function wechatLogin(): Promise<void> {
    if (loading.value) return;

    loading.value = true;
    
    try {
      // 1. 获取微信登录code
      const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        });
      });

      // 2. 调用后端登录接口
      await userStore.loginAction(loginRes.code);
      
      uni.showToast({
        title: '登录成功',
        icon: 'success'
      });

    } catch (error: any) {
      console.error('微信登录失败:', error);
      
      let errorMessage = '登录失败，请重试';
      if (error?.errMsg?.includes('login:fail')) {
        errorMessage = '微信登录失败，请检查网络连接';
      }
      
      uni.showToast({
        title: errorMessage,
        icon: 'none'
      });
      
      throw error;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    wechatLogin
  };
}