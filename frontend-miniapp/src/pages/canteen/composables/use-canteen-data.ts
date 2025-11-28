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
    await canteenStore.fetchWindowList(canteenId).catch(() => {});
  };

  const fetchDishes = async (canteenId: string, extraFilters: GetDishesRequest['filter'] = {}) => {
    const params: GetDishesRequest = {
      filter: { canteenId: [canteenId], ...extraFilters },
      sort: { field: 'averageRating', order: 'desc' },
      pagination: { page: 1, pageSize: 20 },
      search: { keyword: '' },
    };

    try {
      const res = await getDishes(params);
      if (res.code === 200 && res.data) {
        dishes.value = res.data.items || [];
      }
    } catch (err) {
      console.error('fetchDishes error', err);
    }
  };

  const init = async (canteenId: string) => {
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
    filters,
    activeFilter,
    // actions
    init,
    fetchDishes,
    fetchCanteen,
    fetchWindows,
    toggleFilter,
  };
}
