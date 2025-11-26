import { ref, computed } from 'vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import type { Dish } from '@/types/api';

const filters = [
  { key: 'taste', label: '口味' },
  { key: 'price', label: '价格' },
  { key: 'rating', label: '评分' },
  { key: 'type', label: '类型' },
  { key: 'allergen', label: '过敏原' },
];

export function useWindowData() {
  const canteenStore = useCanteenStore();
  const windowInfo = computed(() => canteenStore.currentWindow);
  const dishes = computed<Dish[]>(() => canteenStore.currentWindowDishes);
  const loading = computed(() => canteenStore.loading);
  const storeError = computed(() => canteenStore.error || '');
  const localError = ref('');
  const error = computed(() => localError.value || storeError.value);
  const activeFilter = ref('');

  const fetchWindow = async (windowId: string) => {
    try {
      localError.value = '';
      await canteenStore.fetchWindowDetail(windowId);
    } catch (err) {
      console.error('通过 store 获取窗口详情失败:', err);
      localError.value = err instanceof Error ? err.message : '获取窗口信息失败';
    }
  };

  const fetchDishes = async (windowId: string) => {
    try {
      localError.value = '';
      await canteenStore.fetchWindowDishes(windowId);
    } catch (err) {
      console.error('获取窗口菜品失败:', err);
      localError.value = err instanceof Error ? err.message : '获取菜品信息失败';
    }
  };

  const init = async (windowId: string) => {
    await fetchWindow(windowId);
    await fetchDishes(windowId);
  };

  const toggleFilter = (key: string) => {
    activeFilter.value = activeFilter.value === key ? '' : key;
  };

  return {
    windowInfo,
    loading,
    error,
    dishes,
    filters,
    activeFilter,
    init,
    fetchDishes,
    fetchWindow,
    toggleFilter,
  };
};
