import { ref, onMounted, onScopeDispose, watch, type Ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { startCampusLogin } from '@/api/modules/auth';
import { useUserStore } from '@/store/modules/use-user-store';
import {
  campusLoginMessage,
  clearCampusLoginPending,
  readCampusLoginPending,
  saveCampusLoginPending,
} from '@/utils/campus-login';
import config from '@/config';

export function useCampusLogin(enabled: Ref<boolean>) {
  const user = useUserStore();
  const pending = ref(readCampusLoginPending());
  const code = ref('');
  const starting = ref(false);
  const error = ref('');
  let disposed = false;
  let generation = 0;
  let popup: Window | null = null;
  const reload = () => {
    if (user.isLoggedIn) clearCampusLoginPending();
    pending.value = readCampusLoginPending();
    if (!pending.value) code.value = '';
  };
  onMounted(reload);
  onShow(reload);
  function cancel() {
    generation++;
    starting.value = false;
    clearCampusLoginPending();
    pending.value = null;
    code.value = '';
    error.value = '';
    // #ifdef H5
    popup?.close();
    popup = null;
    // #endif
  }
  watch(
    () => user.sessionVersion,
    () => {
      reload();
      // #ifdef H5
      popup?.close();
      popup = null;
      // #endif
    }
  );
  function receive(event: MessageEvent) {
    // #ifdef H5
    if (disposed || user.isLoggedIn || !enabled.value) return;
    const value = campusLoginMessage(
      event,
      popup,
      new URL(config.baseUrl, window.location.href).origin
    );
    if (value) {
      reload();
      code.value = value;
    }
    // #endif
  }
  // #ifdef H5
  window.addEventListener('message', receive);
  // #endif
  onScopeDispose(() => {
    disposed = true;
    // #ifdef H5
    window.removeEventListener('message', receive);
    popup?.close();
    // #endif
  });
  async function start() {
    if (starting.value || !enabled.value || user.isLoggedIn) return;
    cancel();
    // #ifdef MP-WEIXIN
    if (config.platform === 'mp-weixin') {
      uni.navigateTo({ url: '/pages/login/campus-auth' });
      return;
    }
    // #endif
    const session = user.sessionVersion;
    const attempt = ++generation;
    starting.value = true;
    // #ifdef H5
    const openedPopup = window.open('about:blank', '_blank');
    popup = openedPopup;
    // #endif
    try {
      const response = await startCampusLogin();
      if (disposed || attempt !== generation || session !== user.sessionVersion || !enabled.value) {
        // #ifdef H5
        openedPopup?.close();
        // #endif
        return;
      }
      pending.value = saveCampusLoginPending(response.data);
      // #ifdef H5
      if (openedPopup) openedPopup.location.replace(response.data.authorizationUrl);
      else window.location.assign(response.data.authorizationUrl);
      // #endif
      // #ifdef APP-PLUS
      if (config.platform === 'app') plus.runtime.openURL(response.data.authorizationUrl);
      // #endif
    } catch (cause) {
      // #ifdef H5
      openedPopup?.close();
      // #endif
      if (!disposed && attempt === generation && session === user.sessionVersion)
        error.value = cause instanceof Error ? cause.message : '登录页面暂时无法打开，请重试';
    } finally {
      if (!disposed && attempt === generation) starting.value = false;
    }
  }
  return { pending, code, starting, error, start, cancel, reload };
}
