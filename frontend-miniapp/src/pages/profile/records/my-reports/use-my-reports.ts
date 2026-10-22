import { t } from '@/i18n';
import { computed, ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { getMyReports, getMyReport } from '@/api/modules/user';
import { useUserStore } from '@/store/modules/use-user-store';
import { toUserFriendlyErrorMessage } from '@/utils/user-friendly-error';
import type { Report } from '@/types/api';

export function useMyReports() {
  const user = useUserStore();
  const items = ref<Report[]>([]);
  const focusId = ref('');
  const focusedReport = ref<Report | null>(null);
  const focusError = ref('');
  const error = ref('');
  const loading = ref(false);
  const initialized = ref(false);
  const hasMore = ref(false);
  const visibleItems = computed(() =>
    items.value.filter(item => item.id !== focusedReport.value?.id)
  );
  let page = 0;
  let version = 0;
  let disposed = false;
  let failedAppend = false;
  const reset = () => {
    version++;
    items.value = [];
    focusedReport.value = null;
    focusId.value = '';
    focusError.value = '';
    error.value = '';
    loading.value = false;
    initialized.value = false;
    hasMore.value = false;
    page = 0;
  };
  const load = async (append = false) => {
    if (disposed || !user.isLoggedIn || (append && (loading.value || !hasMore.value))) return;
    const request = ++version;
    const session = user.sessionVersion;
    const owner = user.userInfo?.id;
    const isCurrent = () =>
      !disposed &&
      request === version &&
      session === user.sessionVersion &&
      owner === user.userInfo?.id;
    loading.value = true;
    error.value = '';
    failedAppend = append;
    const nextPage = append ? page + 1 : 1;
    const loadFocus = async () => {
      if (append || !focusId.value) return;
      focusError.value = '';
      focusedReport.value = null;
      try {
        const response = await getMyReport(focusId.value);
        if (!isCurrent()) return;
        if (response.code !== 200 || !response.data)
          throw new Error(response.message || t('account.profile.unableToLoadReportDetails'));
        focusedReport.value = response.data;
      } catch (cause) {
        if (isCurrent()) focusError.value = toUserFriendlyErrorMessage(cause);
      }
    };
    const loadList = async () => {
      try {
        const response = await getMyReports({ page: nextPage, pageSize: 10 });
        if (!isCurrent()) return;
        if (response.code !== 200 || !response.data)
          throw new Error(response.message || t('account.profile.unableToLoadReportsTry'));
        items.value = [
          ...new Map(
            [...(append ? items.value : []), ...response.data.items].map(item => [item.id, item])
          ).values(),
        ];
        page = nextPage;
        hasMore.value = page < response.data.meta.totalPages;
        initialized.value = true;
      } catch (cause) {
        if (isCurrent()) error.value = toUserFriendlyErrorMessage(cause);
      }
    };
    try {
      await Promise.all([loadList(), loadFocus()]);
    } finally {
      if (isCurrent()) loading.value = false;
    }
  };
  watch([() => user.sessionVersion, () => user.userInfo?.id], reset, { flush: 'sync' });
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      version++;
    });
  return {
    items,
    visibleItems,
    focusId,
    focusedReport,
    focusError,
    error,
    loading,
    initialized,
    hasMore,
    refresh: () => load(),
    loadMore: () => load(true),
    retry: () => load(failedAppend),
  };
}
