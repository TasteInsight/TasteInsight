import { getCurrentScope, onScopeDispose, ref } from 'vue';
import config from '@/config';

export function useWechatAuthorization() {
  const available = ref(config.platform === 'mp-weixin');
  let disposed = false;

  if (['app', 'app-plus'].includes(config.platform)) {
    uni.getProvider({
      service: 'oauth',
      success: result => {
        if (!disposed) available.value = result.provider.some(provider => provider === 'weixin');
      },
      fail: () => {
        if (!disposed) available.value = false;
      },
    });
  }

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      available.value = false;
    });

  function authorize(): Promise<string> {
    if (!available.value) return Promise.reject(new Error('当前平台未配置微信登录'));
    return new Promise((resolve, reject) =>
      uni.login({
        provider: 'weixin',
        ...(config.platform === 'mp-weixin' ? {} : { onlyAuthorize: true }),
        success: result => resolve(result.code),
        fail: reject,
      })
    );
  }

  return { available, authorize };
}
