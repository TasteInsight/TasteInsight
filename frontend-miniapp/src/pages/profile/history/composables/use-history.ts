import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { getBrowseHistory } from '@/api/modules/user';
import { useUserStore } from '@/store/modules/use-user-store';
import type { BrowseHistoryItem } from '@/types/api';

export function useHistory() {
  const userStore = useUserStore();
  const historyItems = ref<BrowseHistoryItem[]>([]);
  const loading = ref(false);
  const initialized = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(true);
  let currentPage = 0;
  const pageSize = 10;
  let requestVersion = 0;
  let disposed = false;
  let failedReset = false;

  async function fetchHistory(reset = false): Promise<boolean> {
    if (disposed || !userStore.isLoggedIn || (loading.value && !reset)) return false;
    const session = userStore.sessionVersion;
    const version = ++requestVersion;
    const isCurrent = () =>
      !disposed && session === userStore.sessionVersion && version === requestVersion;
    const firstPage = reset ? 1 : currentPage + 1;
    const lastPage = reset ? Math.max(1, currentPage) : firstPage;
    loading.value = true;
    error.value = null;
    failedReset = reset;

    try {
      const nextItems: BrowseHistoryItem[] = [];
      let loadedPage = firstPage;
      let totalPages = 1;
      for (let page = firstPage; page <= lastPage; page++) {
        const response = await getBrowseHistory({ page, pageSize });
        if (!isCurrent()) return false;
        if (response.code !== 200 || !response.data) {
          throw new Error(response.message || '获取浏览历史失败');
        }
        nextItems.push(...response.data.items);
        loadedPage = page;
        totalPages = response.data.meta.totalPages;
        if (page >= totalPages) break;
      }
      historyItems.value = reset ? nextItems : [...historyItems.value, ...nextItems];
      currentPage = loadedPage;
      hasMore.value = loadedPage < totalPages;
      initialized.value = true;
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      error.value = err instanceof Error ? err.message : '获取浏览历史失败';
      return false;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  const loadMore = (): Promise<boolean> =>
    hasMore.value ? fetchHistory() : Promise.resolve(false);
  const refresh = (): Promise<boolean> => fetchHistory(true);
  const retry = (): Promise<boolean> => fetchHistory(failedReset);

  watch(
    () => userStore.sessionVersion,
    () => {
      requestVersion++;
      historyItems.value = [];
      currentPage = 0;
      loading.value = false;
      initialized.value = false;
      error.value = null;
      hasMore.value = true;
    },
    { flush: 'sync' }
  );

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      requestVersion++;
    });

  return { historyItems, loading, initialized, error, hasMore, fetchHistory, loadMore, refresh, retry };
}
