import { computed, ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import type { User, UserProfileUpdateRequest } from '@/types/api';

export function useSettingsProfile(
  applyProfile: (profile: User | null) => void,
  form: object,
  section: string
) {
  const userStore = useUserStore();
  const saving = ref(false);
  const loading = ref(true);
  const initialized = ref(false);
  const loadError = ref('');
  const saved = ref(false);
  const restoredDraft = ref(false);
  const baseline = ref('');
  const dirty = computed(
    () => initialized.value && !saved.value && JSON.stringify(form) !== baseline.value
  );
  const canEdit = computed(
    () => initialized.value && !loading.value && !saving.value && !saved.value
  );
  const canSave = computed(() => canEdit.value && dirty.value);
  let disposed = false;
  let loadVersion = 0;
  let confirming = false;
  let draftKey = '';
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

  const removeDraft = () => {
    if (draftKey) uni.removeStorageSync(draftKey);
  };

  async function loadProfile(): Promise<boolean> {
    if (saving.value || saved.value) return false;
    const ownsPage = captureOperation();
    const version = ++loadVersion;
    const isCurrent = () => ownsPage() && version === loadVersion;
    loading.value = true;
    loadError.value = '';
    try {
      await userStore.fetchProfileAction(isCurrent);
      if (!isCurrent()) return false;
      if (!userStore.isLoggedIn || !userStore.userInfo) throw new Error('请登录后重新加载');
      applyProfile(userStore.userInfo);
      baseline.value = JSON.stringify(form);
      draftKey = userStore.userInfo.id ? `settings-draft:${userStore.userInfo.id}:${section}` : '';
      initialized.value = true;
      restoredDraft.value = false;
      if (draftKey) {
        const stored = uni.getStorageSync(draftKey);
        if (stored) {
          try {
            const draft = JSON.parse(stored);
            if (
              draft.baseline === baseline.value &&
              draft.value &&
              typeof draft.value === 'object'
            ) {
              for (const key of Object.keys(form)) {
                if (Object.prototype.hasOwnProperty.call(draft.value, key)) {
                  (form as Record<string, unknown>)[key] = draft.value[key];
                }
              }
              restoredDraft.value = dirty.value;
            } else {
              removeDraft();
            }
          } catch {
            removeDraft();
          }
        }
      }
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      loadError.value = error instanceof Error ? error.message : '资料加载失败，请重试';
      return false;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  async function saveProfile(payload: UserProfileUpdateRequest): Promise<boolean> {
    if (!canEdit.value || !userStore.isLoggedIn) return false;
    const isCurrent = captureOperation();
    if (!isCurrent()) return false;
    saving.value = true;
    const snapshot = JSON.stringify(form);
    try {
      await userStore.updateProfileAction(payload);
      if (!isCurrent()) return false;
      baseline.value = snapshot;
      saved.value = true;
      restoredDraft.value = false;
      removeDraft();
      uni.showToast({ title: '保存成功', icon: 'success' });
      navigationTimer = setTimeout(() => {
        navigationTimer = null;
        if (isCurrent()) uni.navigateBack();
      }, 1000);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
      return false;
    } finally {
      if (isCurrent()) saving.value = false;
    }
  }

  async function requestLeave(): Promise<boolean> {
    if (saving.value || confirming) return false;
    const isCurrent = captureOperation();
    confirming = true;
    try {
      const confirmed = await confirmDiscardChanges(dirty.value, '放弃未保存的修改？');
      if (!confirmed || !isCurrent()) return false;
      baseline.value = JSON.stringify(form);
      removeDraft();
      return true;
    } finally {
      confirming = false;
    }
  }

  function handleBackPress(event: { from?: string } = {}): boolean {
    if (event.from === 'navigateBack') return false;
    if (saving.value) return true;
    if (!dirty.value) return false;
    void requestLeave().then(leave => {
      if (leave) uni.navigateBack();
    });
    return true;
  }

  watch(
    [() => userStore.sessionVersion, () => userStore.isLoggedIn],
    () => {
      cancelNavigation();
      loadVersion++;
      applyProfile(null);
      draftKey = '';
      baseline.value = '';
      initialized.value = false;
      loading.value = false;
      saving.value = false;
      saved.value = false;
      restoredDraft.value = false;
      loadError.value = '登录状态已变更，请重新加载';
    },
    { flush: 'sync' }
  );

  if (getCurrentScope())
    onScopeDispose(() => {
      if (draftKey && dirty.value) {
        uni.setStorageSync(draftKey, JSON.stringify({ baseline: baseline.value, value: form }));
      }
      disposed = true;
      cancelNavigation();
    });

  return {
    saving,
    loading,
    initialized,
    loadError,
    saved,
    dirty,
    canEdit,
    canSave,
    restoredDraft,
    captureOperation,
    loadProfile,
    saveProfile,
    requestLeave,
    handleBackPress,
  };
}
