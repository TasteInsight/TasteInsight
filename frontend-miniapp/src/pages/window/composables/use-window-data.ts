import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getWindowDetail } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import { getPreferredDishSort } from '@/utils/dish-sort';
import type { Dish, Window, PaginationParams } from '@/types/api';

export function useWindowData() {
  const userStore = useUserStore();
  const windowInfo = ref<Window | null>(null);
  const dishes = ref<Dish[]>([]);
  const dishesInitialized = ref(false);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(true);
  const currentPage = ref(0);
  const pageSize = 20;
  const error = ref('');
  const headerError = ref('');
  const headerLoading = ref(false);
  const errorIsAppend = ref(false);
  let currentWindowId = '';
  const selectWindow = (windowId: string) => {
    if (currentWindowId === windowId) return;
    currentWindowId = windowId;
    windowInfo.value = null;
    dishes.value = [];
    dishesInitialized.value = false;
    headerError.value = '';
    currentPage.value = 0;
    hasMore.value = true;
  };
  const preferredSort = () =>
    getPreferredDishSort(userStore.userInfo?.settings?.displaySettings?.sortBy);
  let querySort = preferredSort();
  let operationVersion = 0;
  let dishRequestVersion = 0;
  let disposed = false;

  const captureOperation = () => {
    const operation = operationVersion;
    const session = userStore.sessionVersion;
    return () =>
      !disposed && operation === operationVersion && session === userStore.sessionVersion;
  };

  const beginOperation = () => {
    operationVersion += 1;
    dishRequestVersion += 1;
    error.value = '';
    loading.value = false;
    loadingMore.value = false;
    return captureOperation();
  };

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
    });

  const fetchWindow = async (windowId: string, isCurrent = beginOperation()) => {
    if (!isCurrent()) return false;
    selectWindow(windowId);
    headerLoading.value = true;
    try {
      headerError.value = '';
      const response = await getWindowDetail(windowId);
      if (!isCurrent()) return false;
      if (response.code !== 200 || !response.data)
        throw new Error(response.message || '获取窗口详情失败');
      windowInfo.value = response.data;
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      console.error('获取窗口详情失败:', err);
      headerError.value = err instanceof Error ? err.message : '获取窗口信息失败';
      return false;
    } finally {
      if (isCurrent()) headerLoading.value = false;
    }
  };

  const fetchDishes = async (
    windowId: string,
    pagination?: PaginationParams,
    options?: { append?: boolean },
    isCurrent = captureOperation()
  ) => {
    if (!isCurrent()) return false;
    const append = options?.append === true;
    const request = ++dishRequestVersion;
    const ownsQuery = () => isCurrent() && request === dishRequestVersion;
    if (!append) {
      selectWindow(windowId);
      querySort = preferredSort();
    }
    errorIsAppend.value = append;
    loadingMore.value = append;
    loading.value = !append;

    try {
      error.value = '';

      const page = pagination?.page ?? 1;
      const size = pagination?.pageSize ?? pageSize;
      const res = await getDishes({
        filter: { windowId: [windowId], includeOffline: false },
        search: { keyword: '' },
        sort: { ...querySort },
        pagination: { page, pageSize: size },
      });
      if (!ownsQuery()) return false;
      if (res.code === 200 && res.data) {
        const items = res.data.items || [];
        dishes.value = append ? [...dishes.value, ...items] : items;
        dishesInitialized.value = true;
        currentPage.value = res.data.meta.page;
        hasMore.value = res.data.meta.page < res.data.meta.totalPages;
        return true;
      } else {
        throw new Error(res.message || '获取菜品列表失败');
      }
    } catch (err) {
      if (!ownsQuery()) return false;
      console.error('获取窗口菜品失败:', err);
      error.value = err instanceof Error ? err.message : '获取菜品信息失败';
      return false;
    } finally {
      if (ownsQuery()) {
        if (append) loadingMore.value = false;
        else loading.value = false;
      }
    }
  };

  const init = async (windowId: string, isCurrent = beginOperation()) => {
    if (!isCurrent()) return false;
    const initialDishRequest = dishRequestVersion;
    selectWindow(windowId);
    loading.value = true;
    try {
      if (!(await fetchWindow(windowId, isCurrent)) || !isCurrent()) return false;
      if (initialDishRequest !== dishRequestVersion) return true;
      return await fetchDishes(windowId, { page: 1, pageSize }, undefined, isCurrent);
    } finally {
      if (isCurrent() && initialDishRequest === dishRequestVersion) loading.value = false;
    }
  };

  const loadMoreDishes = async (windowId: string) => {
    if (loading.value || loadingMore.value) return;
    if (!hasMore.value) return;
    if (currentPage.value === 0) return;
    if (error.value && !errorIsAppend.value) return;
    const nextPage = currentPage.value + 1;
    await fetchDishes(windowId, { page: nextPage, pageSize }, { append: true });
  };

  const retryDishes = () =>
    errorIsAppend.value ? loadMoreDishes(currentWindowId) : fetchDishes(currentWindowId);
  const refreshPreferredSort = () => {
    if (currentWindowId && JSON.stringify(querySort) !== JSON.stringify(preferredSort())) {
      return fetchDishes(currentWindowId);
    }
  };

  watch(
    () => userStore.sessionVersion,
    () => {
      operationVersion += 1;
      dishRequestVersion += 1;
      currentWindowId = '';
      windowInfo.value = null;
      dishes.value = [];
      dishesInitialized.value = false;
      loading.value = false;
      loadingMore.value = false;
      error.value = '';
      headerError.value = '';
      headerLoading.value = false;
      currentPage.value = 0;
      hasMore.value = true;
    },
    { flush: 'sync' }
  );

  return {
    windowInfo,
    loading,
    loadingMore,
    hasMore,
    error,
    headerError,
    headerLoading,
    errorIsAppend,
    dishes,
    dishesInitialized,
    beginOperation,
    init,
    fetchDishes,
    loadMoreDishes,
    fetchWindow,
    retryDishes,
    refreshPreferredSort,
  };
}
