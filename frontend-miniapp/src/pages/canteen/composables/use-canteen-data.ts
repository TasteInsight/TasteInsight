import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getCanteenDetail, getWindowList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { GetDishesRequest, Dish, Canteen, Window } from '@/types/api';

export function useCanteenData() {
  const userStore = useUserStore();

  const canteenInfo = ref<Canteen | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const windows = ref<Window[]>([]);

  const dishes = ref<Dish[]>([]);
  const dishesLoading = ref(false);
  const dishesLoadingMore = ref(false);
  const hasMore = ref(true);
  const currentPage = ref(1);
  const pageSize = 20;
  const currentCanteenId = ref('');
  const currentExtraFilters = ref<GetDishesRequest['filter']>({});
  let operationVersion = 0;
  let dishRequestVersion = 0;
  let disposed = false;

  const captureOperation = () => {
    const operation = operationVersion;
    const session = userStore.sessionVersion;
    return () => !disposed && operation === operationVersion && session === userStore.sessionVersion;
  };

  const beginOperation = () => {
    operationVersion += 1;
    dishRequestVersion += 1;
    loading.value = false;
    error.value = null;
    dishesLoading.value = false;
    dishesLoadingMore.value = false;
    return captureOperation();
  };

  if (getCurrentScope()) onScopeDispose(() => { disposed = true; });

  const filters = [
    { key: 'taste', label: '口味' },
    { key: 'price', label: '价格' },
    { key: 'rating', label: '评分' },
    { key: 'type', label: '荤素' },
    { key: 'allergen', label: '过敏原' },
  ];
  const activeFilter = ref<string>('');

  const fetchCanteen = async (canteenId: string, isCurrent: () => boolean) => {
    if (!isCurrent()) return false;
    try {
      const response = await getCanteenDetail(canteenId);
      if (!isCurrent()) return false;
      if (response.code !== 200 || !response.data) throw new Error(response.message || '获取食堂详情失败');
      canteenInfo.value = response.data;
      return true;
    } catch (err) {
      if (isCurrent()) error.value = err instanceof Error ? err.message : '获取食堂详情失败';
      return false;
    }
  };

  const fetchWindows = async (canteenId: string, isCurrent: () => boolean) => {
    if (!isCurrent()) return false;
    try {
      const response = await getWindowList(canteenId, { page: 1, pageSize: 50 });
      if (!isCurrent()) return false;
      if (response.code !== 200 || !response.data) throw new Error(response.message || '获取窗口列表失败');
      windows.value = response.data.items;
      return true;
    } catch (err) {
      if (isCurrent()) error.value = err instanceof Error ? err.message : '获取窗口列表失败';
      return false;
    }
  };

  const fetchDishes = async (
    canteenId: string,
    extraFilters: GetDishesRequest['filter'] = {},
    reset = true,
    isCurrent = captureOperation()
  ) => {
    if (!isCurrent()) return false;
    const request = ++dishRequestVersion;
    const ownsQuery = () => isCurrent() && request === dishRequestVersion;
    error.value = null;
    if (reset) {
      currentPage.value = 1;
      dishes.value = [];
      hasMore.value = true;
    }

    currentCanteenId.value = canteenId;
    currentExtraFilters.value = extraFilters;

    const params: GetDishesRequest = {
      filter: { canteenId: [canteenId], ...extraFilters },
      sort: { field: 'averageRating', order: 'desc' },
      pagination: { page: currentPage.value, pageSize },
      search: { keyword: '' },
    };

    dishesLoading.value = reset;
    dishesLoadingMore.value = !reset;

    try {
      const res = await getDishes(params);
      if (!ownsQuery()) return false;
      if (res.code === 200 && res.data) {
        const items = res.data.items || [];
        dishes.value = reset ? items : [...dishes.value, ...items];
        hasMore.value = currentPage.value < res.data.meta.totalPages;
        return true;
      }
      return false;
    } catch (err) {
      if (!ownsQuery()) return false;
      console.error('fetchDishes error', err);
      error.value = err instanceof Error ? err.message : '获取菜品列表失败';
      return false;
    } finally {
      if (ownsQuery()) {
        if (reset) dishesLoading.value = false;
        else dishesLoadingMore.value = false;
      }
    }
  };

  const loadMoreDishes = async () => {
    if (dishesLoading.value || dishesLoadingMore.value) return;
    if (!hasMore.value) return;
    if (!currentCanteenId.value) return;

    currentPage.value += 1;
    await fetchDishes(currentCanteenId.value, currentExtraFilters.value, false);
  };

  const init = async (
    canteenId: string,
    extraFilters: GetDishesRequest['filter'] = {},
    isCurrent = beginOperation()
  ) => {
    if (!isCurrent()) return false;
    const initialDishRequest = dishRequestVersion;
    currentCanteenId.value = canteenId;
    currentExtraFilters.value = extraFilters;
    currentPage.value = 1;
    hasMore.value = true;
    loading.value = true;
    dishesLoading.value = true;
    try {
      if (!await fetchCanteen(canteenId, isCurrent) || !isCurrent()) return false;
      if (!await fetchWindows(canteenId, isCurrent) || !isCurrent()) return false;
      // 新筛选已接管菜品列表时，初始化只完成食堂与窗口刷新。
      if (initialDishRequest !== dishRequestVersion) return true;
      return await fetchDishes(canteenId, extraFilters, true, isCurrent);
    } finally {
      if (isCurrent()) {
        loading.value = false;
        if (initialDishRequest === dishRequestVersion) dishesLoading.value = false;
      }
    }
  };

  const toggleFilter = (key: string) => {
    activeFilter.value = activeFilter.value === key ? '' : key;
  };

  watch(() => userStore.sessionVersion, () => {
    operationVersion += 1;
    dishRequestVersion += 1;
    canteenInfo.value = null;
    windows.value = [];
    loading.value = false;
    error.value = null;
    dishes.value = [];
    dishesLoading.value = false;
    dishesLoadingMore.value = false;
    currentCanteenId.value = '';
    currentExtraFilters.value = {};
    currentPage.value = 1;
    hasMore.value = true;
    activeFilter.value = '';
  }, { flush: 'sync' });

  return {
    // 页面快照
    canteenInfo,
    loading,
    error,
    windows,
    // local
    dishes,
    hasMore,
    dishesLoading,
    dishesLoadingMore,
    filters,
    activeFilter,
    // actions
    beginOperation,
    init,
    fetchDishes,
    loadMoreDishes,
    toggleFilter,
  };
}
