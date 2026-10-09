import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { getMyFavorites } from '@/api/modules/user';
import { useUserStore } from '@/store/modules/use-user-store';
import { unfavoriteDish } from '@/api/modules/dish';
import type { Favorite } from '@/types/api';

export function useFavorites() {
  const userStore = useUserStore();
  const favoriteItems = ref<Favorite[]>([]);
  const loading = ref(false);
  const initialized = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(true);
  let currentPage = 0;
  const pageSize = 10;
  let requestVersion = 0;
  let disposed = false;
  let failedReset = false;
  const removingIds = ref<string[]>([]);
  let needsRevalidation = false;

  async function fetchFavorites(reset = false): Promise<boolean> {
    if (disposed || !userStore.isLoggedIn) return false;
    if (reset) needsRevalidation = true;
    if (removingIds.value.length > 0 || (loading.value && !reset)) return false;
    reset = reset || needsRevalidation;
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
      const nextItems: Favorite[] = [];
      let loadedPage = firstPage;
      let totalPages = 1;
      for (let page = firstPage; page <= lastPage; page++) {
        const response = await getMyFavorites({ page, pageSize });
        if (!isCurrent()) return false;
        if (response.code !== 200 || !response.data) {
          throw new Error(response.message || '获取收藏列表失败');
        }
        nextItems.push(...response.data.items);
        loadedPage = page;
        totalPages = response.data.meta.totalPages;
        if (page >= totalPages) break;
      }
      favoriteItems.value = reset ? nextItems : [...favoriteItems.value, ...nextItems];
      currentPage = loadedPage;
      hasMore.value = loadedPage < totalPages;
      needsRevalidation = false;
      initialized.value = true;
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      error.value = err instanceof Error ? err.message : '获取收藏列表失败';
      return false;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  const loadMore = (): Promise<boolean> =>
    hasMore.value ? fetchFavorites() : Promise.resolve(false);
  const refresh = (): Promise<boolean> => fetchFavorites(true);
  const retry = (): Promise<boolean> => fetchFavorites(failedReset);

  async function removeFavorite(dishId: string): Promise<boolean> {
    if (disposed || !userStore.isLoggedIn || loading.value || removingIds.value.includes(dishId))
      return false;
    const session = userStore.sessionVersion;
    const isCurrent = () => !disposed && session === userStore.sessionVersion;
    removingIds.value.push(dishId);
    let succeeded = false;
    try {
      const response = await unfavoriteDish(dishId);
      if (!isCurrent()) return false;
      if (response.code !== 200) throw new Error(response.message || '取消收藏失败');
      favoriteItems.value = favoriteItems.value.filter(item => item.dishId !== dishId);
      needsRevalidation = true;
      succeeded = true;
      uni.showToast({ title: '已取消收藏', icon: 'success' });
    } catch (err) {
      if (isCurrent())
        uni.showToast({
          title: err instanceof Error ? err.message : '取消收藏失败',
          icon: 'none',
        });
    } finally {
      if (isCurrent()) removingIds.value = removingIds.value.filter(id => id !== dishId);
    }
    if (needsRevalidation && isCurrent() && removingIds.value.length === 0) await refresh();
    return succeeded;
  }

  watch(
    () => userStore.sessionVersion,
    () => {
      requestVersion++;
      favoriteItems.value = [];
      currentPage = 0;
      loading.value = false;
      initialized.value = false;
      error.value = null;
      hasMore.value = true;
      removingIds.value = [];
      needsRevalidation = false;
    },
    { flush: 'sync' }
  );

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      requestVersion++;
    });

  return {
    favoriteItems,
    loading,
    initialized,
    error,
    hasMore,
    fetchFavorites,
    loadMore,
    refresh,
    retry,
    removeFavorite,
    removingIds,
  };
}
