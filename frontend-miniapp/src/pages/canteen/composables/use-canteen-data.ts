import { ref, computed } from 'vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { getDishes } from '@/api/modules/dish';
import type { GetDishesRequest, Dish } from '@/types/api';

export function useCanteenData() {
  const canteenStore = useCanteenStore();

  const canteenInfo = computed(() => canteenStore.currentCanteen);
  const loading = computed(() => canteenStore.loading);
  const error = computed(() => canteenStore.error);
  const windows = computed(() => canteenStore.windowList);

  const dishes = ref<Dish[]>([]);
  const dishesLoading = ref(false);
  const dishesLoadingMore = ref(false);
  const hasMore = ref(true);
  const currentPage = ref(1);
  const pageSize = 20;
  const currentCanteenId = ref('');
  const currentExtraFilters = ref<GetDishesRequest['filter']>({});

  const filters = [
    { key: 'taste', label: '口味' },
    { key: 'price', label: '价格' },
    { key: 'rating', label: '评分' },
    { key: 'type', label: '荤素' },
    { key: 'allergen', label: '过敏原' },
  ];
  const activeFilter = ref<string>('');

  const fetchCanteen = async (canteenId: string) => {
    await canteenStore.fetchCanteenDetail(canteenId).catch(() => {});
  };

  const fetchWindows = async (canteenId: string) => {
    await canteenStore.fetchWindowList(canteenId, { page: 1, pageSize: 50 }).catch(() => {});
  };

  const fetchDishes = async (
    canteenId: string,
    extraFilters: GetDishesRequest['filter'] = {},
    reset = true
  ) => {
    if (reset) {
      currentPage.value = 1;
      dishes.value = [];
      hasMore.value = true;
    }

    currentCanteenId.value = canteenId;
    currentExtraFilters.value = extraFilters;

    const params: GetDishesRequest = {
      filter: { canteenId: [canteenId], ...extraFilters },
      isSuggestion: false, // 食堂详情页不使用推荐模式
      sort: { field: 'averageRating', order: 'desc' },
      pagination: { page: currentPage.value, pageSize },
      search: { keyword: '' },
    };

    if (reset) {
      dishesLoading.value = true;
    } else {
      dishesLoadingMore.value = true;
    }

    try {
      const res = await getDishes(params);
      if (res.code === 200 && res.data) {
        const items = res.data.items || [];
        dishes.value = reset ? items : [...dishes.value, ...items];
        hasMore.value = currentPage.value < res.data.meta.totalPages;
      }
    } catch (err) {
      console.error('fetchDishes error', err);
    } finally {
      if (reset) {
        dishesLoading.value = false;
      } else {
        dishesLoadingMore.value = false;
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

  const init = async (canteenId: string) => {
    currentCanteenId.value = canteenId;
    currentExtraFilters.value = {};
    currentPage.value = 1;
    hasMore.value = true;
    await fetchCanteen(canteenId);
    await fetchWindows(canteenId);
    await fetchDishes(canteenId);
  };

  const toggleFilter = (key: string) => {
    activeFilter.value = activeFilter.value === key ? '' : key;
  };

  return {
    // store-linked
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
    init,
    fetchDishes,
    loadMoreDishes,
    fetchCanteen,
    fetchWindows,
    toggleFilter,
  };
}
