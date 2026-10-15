import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue';
import config from '@/config';

export function useWechatAuthorization(enabled: Ref<boolean> = ref(true)) {
  const available = ref(false);
  const checking = ref(false);
  let disposed = false;
  let discoveryVersion = 0;

  watch(
    enabled,
    active => {
      const version = ++discoveryVersion;
      available.value = active && config.platform === 'mp-weixin';
      checking.value = false;
      if (!active || !['app', 'app-plus'].includes(config.platform)) return;
      checking.value = true;
      uni.getProvider({
        service: 'oauth',
        success: result => {
          if (!disposed && version === discoveryVersion) {
            available.value = result.provider.some(provider => provider === 'weixin');
            checking.value = false;
          }
        },
        fail: () => {
          if (!disposed && version === discoveryVersion) {
            available.value = false;
            checking.value = false;
          }
        },
      });
    },
    { immediate: true, flush: 'sync' }
  );

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      available.value = false;
      checking.value = false;
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

  return { available, checking, authorize };
}
