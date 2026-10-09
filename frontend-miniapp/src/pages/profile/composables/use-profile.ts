import { ref, computed, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import type { UserProfileUpdateRequest } from '@/types/api';

export function useProfile() {
  const userStore = useUserStore();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const userInfo = computed(() => userStore.userInfo);
  const isLoggedIn = computed(() => userStore.isLoggedIn);
  let disposed = false;
  let requestVersion = 0;
  let logoutTimer: ReturnType<typeof setTimeout> | null = null;
  const captureOperation = () => {
    const session = userStore.sessionVersion;
    const version = ++requestVersion;
    return () => !disposed && session === userStore.sessionVersion && version === requestVersion;
  };

  async function fetchProfile(): Promise<boolean> {
    if (loading.value || !isLoggedIn.value || disposed) return false;
    const isCurrent = captureOperation();
    loading.value = true;
    error.value = null;
    try {
      await userStore.fetchProfileAction(isCurrent);
      return isCurrent();
    } catch (err) {
      if (isCurrent()) error.value = err instanceof Error ? err.message : '刷新用户信息失败';
      return false;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  async function updateProfile(data: UserProfileUpdateRequest): Promise<boolean> {
    if (loading.value || !isLoggedIn.value || disposed) return false;
    const isCurrent = captureOperation();
    loading.value = true;
    error.value = null;
    try {
      await userStore.updateProfileAction(data);
      if (!isCurrent()) return false;
      uni.showToast({ title: '更新成功', icon: 'success' });
      return true;
    } catch (err) {
      if (isCurrent()) {
        error.value = err instanceof Error ? err.message : '更新用户信息失败';
        uni.showToast({ title: error.value, icon: 'none' });
      }
      return false;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  function handleLogout() {
    const session = userStore.sessionVersion;
    uni.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (!res.confirm || disposed || session !== userStore.sessionVersion) return;
        userStore.logoutAction();
        const loggedOutSession = userStore.sessionVersion;
        uni.showToast({ title: '已退出登录', icon: 'success' });
        logoutTimer = setTimeout(() => {
          logoutTimer = null;
          if (!disposed && loggedOutSession === userStore.sessionVersion && !userStore.isLoggedIn) {
            uni.reLaunch({ url: '/pages/login/index' });
          }
        }, 500);
      },
    });
  }

  watch(
    () => userStore.sessionVersion,
    () => {
      requestVersion++;
      loading.value = false;
      error.value = null;
    },
    { flush: 'sync' }
  );
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      if (logoutTimer) clearTimeout(logoutTimer);
    });
  return { loading, error, userInfo, isLoggedIn, fetchProfile, updateProfile, handleLogout };
}
