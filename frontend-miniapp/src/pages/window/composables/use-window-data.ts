import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getWindowDetail, getWindowDishes } from '@/api/modules/canteen';
import type { Dish, Window, PaginationParams } from '@/types/api';

export function useWindowData() {
  const userStore = useUserStore();
  const windowInfo = ref<Window | null>(null);
  // dishes 现在通过 local ref 维护，支持筛选后更新
  const dishes = ref<Dish[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(true);
  const currentPage = ref(1);
  const pageSize = 20;
  const error = ref('');
  let operationVersion = 0;
  let disposed = false;

  const captureOperation = () => {
    const operation = operationVersion;
    const session = userStore.sessionVersion;
    return () => !disposed && operation === operationVersion && session === userStore.sessionVersion;
  };

  const beginOperation = () => {
    operationVersion += 1;
    error.value = '';
    loading.value = false;
    loadingMore.value = false;
    return captureOperation();
  };

  if (getCurrentScope()) onScopeDispose(() => { disposed = true; });

  const fetchWindow = async (windowId: string, isCurrent = beginOperation()) => {
    if (!isCurrent()) return false;
    try {
      error.value = '';
      const response = await getWindowDetail(windowId);
      if (!isCurrent()) return false;
      if (response.code !== 200 || !response.data) throw new Error(response.message || '获取窗口详情失败');
      windowInfo.value = response.data;
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      console.error('获取窗口详情失败:', err);
      error.value = err instanceof Error ? err.message : '获取窗口信息失败';
      return false;
    }
  };

  const fetchDishes = async (
    windowId: string,
    pagination?: PaginationParams,
    options?: { append?: boolean },
    isCurrent = beginOperation()
  ) => {
    if (!isCurrent()) return false;
    const append = options?.append === true;

    if (append) {
      loadingMore.value = true;
    } else {
      loading.value = true;
    }
    try {
      error.value = '';

      const page = pagination?.page ?? 1;
      const size = pagination?.pageSize ?? pageSize;
      const res = await getWindowDishes(windowId, { page, pageSize: size });
      if (!isCurrent()) return false;
      if (res.code === 200 && res.data) {
        const items = res.data.items || [];
        dishes.value = append ? [...dishes.value, ...items] : items;
        currentPage.value = res.data.meta.page;
        hasMore.value = res.data.meta.page < res.data.meta.totalPages;
        return true;
      } else {
        throw new Error(res.message || '获取菜品列表失败');
      }
    } catch (err) {
      if (!isCurrent()) return false;
      console.error('获取窗口菜品失败:', err);
      error.value = err instanceof Error ? err.message : '获取菜品信息失败';
      return false;
    } finally {
      if (isCurrent()) {
        if (append) loadingMore.value = false;
        else loading.value = false;
      }
    }
  };

  const init = async (windowId: string, isCurrent = beginOperation()) => {
    if (!isCurrent()) return false;
    currentPage.value = 1;
    hasMore.value = true;
    loading.value = true;
    try {
      if (!await fetchWindow(windowId, isCurrent) || !isCurrent()) return false;
      return await fetchDishes(windowId, { page: 1, pageSize }, undefined, isCurrent);
    } finally {
      if (isCurrent()) loading.value = false;
    }
  };

  const loadMoreDishes = async (windowId: string) => {
    if (loading.value || loadingMore.value) return;
    if (!hasMore.value) return;
    const nextPage = currentPage.value + 1;
    await fetchDishes(windowId, { page: nextPage, pageSize }, { append: true });
  };

  watch(() => userStore.sessionVersion, () => {
    operationVersion += 1;
    windowInfo.value = null;
    dishes.value = [];
    loading.value = false;
    loadingMore.value = false;
    error.value = '';
    currentPage.value = 1;
    hasMore.value = true;
  }, { flush: 'sync' });

  return {
    windowInfo,
    loading,
    loadingMore,
    hasMore,
    error,
    dishes,
    beginOperation,
    init,
    fetchDishes,
    loadMoreDishes,
    fetchWindow,
  };
}
