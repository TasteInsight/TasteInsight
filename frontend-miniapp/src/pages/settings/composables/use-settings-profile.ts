import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import type { User, UserProfileUpdateRequest } from '@/types/api';

export function useSettingsProfile(applyProfile: (profile: User | null) => void) {
  const userStore = useUserStore();
  const saving = ref(false);
  const loading = ref(true);
  let disposed = false;
  let navigationTimer: ReturnType<typeof setTimeout> | null = null;

  const captureOperation = () => {
    const session = userStore.sessionVersion;
    return () => !disposed && session === userStore.sessionVersion;
  };

  const cancelNavigation = () => {
    if (navigationTimer === null) return;
    clearTimeout(navigationTimer);
    navigationTimer = null;
  };

  async function loadProfile() {
    const isCurrent = captureOperation();
    loading.value = true;
    try {
      await userStore.fetchProfileAction(isCurrent);
      if (isCurrent()) applyProfile(userStore.userInfo);
    } catch (error) {
      if (isCurrent()) console.error('加载用户信息失败:', error);
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  async function saveProfile(payload: UserProfileUpdateRequest): Promise<boolean> {
    if (saving.value) return false;
    const isCurrent = captureOperation();
    if (!isCurrent()) return false;
    cancelNavigation();
    saving.value = true;
    try {
      await userStore.updateProfileAction(payload);
      if (!isCurrent()) return false;
      uni.showToast({ title: '保存成功', icon: 'success' });
      navigationTimer = setTimeout(() => {
        navigationTimer = null;
        if (isCurrent()) uni.navigateBack();
      }, 1000);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      console.error('保存失败:', error);
      uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
      return false;
    } finally {
      if (isCurrent()) saving.value = false;
    }
  }

  watch(
    [() => userStore.sessionVersion, () => (userStore.isLoggedIn ? userStore.userInfo?.id : null)],
    () => {
      cancelNavigation();
      applyProfile(userStore.isLoggedIn ? userStore.userInfo : null);
      loading.value = false;
      saving.value = false;
    },
    { flush: 'sync' }
  );

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      cancelNavigation();
    });

  return { saving, loading, captureOperation, loadProfile, saveProfile };
}
