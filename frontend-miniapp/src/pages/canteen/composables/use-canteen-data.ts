import { ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getCanteenDetail, getWindowList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { GetDishesRequest, Dish, Canteen, Window } from '@/types/api';
import { getPreferredDishSort } from '@/utils/dish-sort';

export function useCanteenData() {
  const userStore = useUserStore();

  const canteenInfo = ref<Canteen | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const windows = ref<Window[]>([]);

  const dishes = ref<Dish[]>([]);
  const dishesInitialized = ref(false);
  const dishesLoading = ref(false);
  const dishesLoadingMore = ref(false);
  const dishesError = ref('');
  const dishErrorIsAppend = ref(false);
  const hasMore = ref(true);
  const currentPage = ref(0);
  const pageSize = 20;
  const currentCanteenId = ref('');
  const currentExtraFilters = ref<GetDishesRequest['filter']>({});
  const selectCanteen = (canteenId: string) => {
    if (currentCanteenId.value === canteenId) return;
    currentCanteenId.value = canteenId;
    canteenInfo.value = null;
    windows.value = [];
    dishes.value = [];
    dishesInitialized.value = false;
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
    loading.value = false;
    error.value = null;
    dishesLoading.value = false;
    dishesLoadingMore.value = false;
    dishesError.value = '';
    return captureOperation();
  };

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
    });

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
      if (response.code !== 200 || !response.data)
        throw new Error(response.message || '获取食堂详情失败');
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
      if (response.code !== 200 || !response.data)
        throw new Error(response.message || '获取窗口列表失败');
      const items = [...response.data.items];
      for (let page = 2; page <= response.data.meta.totalPages; page += 1) {
        const next = await getWindowList(canteenId, { page, pageSize: 50 });
        if (!isCurrent()) return false;
        if (next.code !== 200 || !next.data) throw new Error(next.message || '获取窗口列表失败');
        items.push(...next.data.items);
      }
      windows.value = items;
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
    dishesError.value = '';
    dishErrorIsAppend.value = !reset;
    if (reset) {
      querySort = preferredSort();
      selectCanteen(canteenId);
      currentExtraFilters.value = { ...extraFilters };
    }
    const requestedPage = reset ? 1 : currentPage.value + 1;

    const params: GetDishesRequest = {
      filter: { ...currentExtraFilters.value, canteenId: [canteenId], includeOffline: false },
      sort: { ...querySort },
      pagination: { page: requestedPage, pageSize },
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
        dishesInitialized.value = true;
        currentPage.value = res.data.meta.page ?? requestedPage;
        hasMore.value = currentPage.value < res.data.meta.totalPages;
        return true;
      }
      throw new Error(res.message || '获取菜品列表失败');
    } catch (err) {
      if (!ownsQuery()) return false;
      console.error('fetchDishes error', err);
      dishesError.value = err instanceof Error ? err.message : '获取菜品列表失败';
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
    if (currentPage.value === 0) return;
    if (dishesError.value && !dishErrorIsAppend.value) return;
    await fetchDishes(currentCanteenId.value, currentExtraFilters.value, false);
  };

  const retryDishes = () =>
    fetchDishes(currentCanteenId.value, currentExtraFilters.value, !dishErrorIsAppend.value);
  const refreshPreferredSort = () => {
    if (currentCanteenId.value && JSON.stringify(preferredSort()) !== JSON.stringify(querySort)) {
      return fetchDishes(currentCanteenId.value, currentExtraFilters.value);
    }
  };

  const init = async (
    canteenId: string,
    extraFilters: GetDishesRequest['filter'] = {},
    isCurrent = beginOperation()
  ) => {
    if (!isCurrent()) return false;
    const initialDishRequest = dishRequestVersion;
    selectCanteen(canteenId);
    currentExtraFilters.value = extraFilters;
    loading.value = true;
    dishesLoading.value = true;
    try {
      if (!(await fetchCanteen(canteenId, isCurrent)) || !isCurrent()) return false;
      if (!(await fetchWindows(canteenId, isCurrent)) || !isCurrent()) return false;
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

  watch(
    () => userStore.sessionVersion,
    () => {
      operationVersion += 1;
      dishRequestVersion += 1;
      canteenInfo.value = null;
      windows.value = [];
      loading.value = false;
      error.value = null;
      dishes.value = [];
      dishesInitialized.value = false;
      dishesLoading.value = false;
      dishesLoadingMore.value = false;
      dishesError.value = '';
      currentCanteenId.value = '';
      currentExtraFilters.value = {};
      currentPage.value = 0;
      hasMore.value = true;
      activeFilter.value = '';
    },
    { flush: 'sync' }
  );

  return {
    // 页面快照
    canteenInfo,
    loading,
    error,
    windows,
    // local
    dishes,
    dishesInitialized,
    hasMore,
    dishesLoading,
    dishesLoadingMore,
    dishesError,
    dishErrorIsAppend,
    filters,
    activeFilter,
    // actions
    beginOperation,
    init,
    fetchDishes,
    loadMoreDishes,
    retryDishes,
    refreshPreferredSort,
    toggleFilter,
  };
}
