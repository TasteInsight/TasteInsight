import { ref, computed } from 'vue';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { getWindowDishes } from '@/api/modules/canteen';
import type { Dish, PaginationParams } from '@/types/api';

export function useWindowData() {
  const canteenStore = useCanteenStore();
  const windowInfo = computed(() => canteenStore.currentWindow);
  // dishes 现在通过 local ref 维护，支持筛选后更新
  const dishes = ref<Dish[]>([]); 
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(true);
  const currentPage = ref(1);
  const pageSize = 20;
  const storeError = computed(() => canteenStore.error || '');
  const localError = ref('');
  const error = computed(() => localError.value || storeError.value);

  const fetchWindow = async (windowId: string) => {
    try {
      localError.value = '';
      await canteenStore.fetchWindowDetail(windowId);
    } catch (err) {
      console.error('通过 store 获取窗口详情失败:', err);
      localError.value = err instanceof Error ? err.message : '获取窗口信息失败';
    }
  };

  const fetchDishes = async (
    windowId: string,
    pagination?: PaginationParams,
    options?: { append?: boolean }
  ) => {
    const append = options?.append === true;

    if (append) {
      loadingMore.value = true;
    } else {
      loading.value = true;
    }
    try {
      localError.value = '';
      
      const page = pagination?.page ?? 1;
      const size = pagination?.pageSize ?? pageSize;
      const res = await getWindowDishes(windowId, { page, pageSize: size });
      if (res.code === 200 && res.data) {
        const items = res.data.items || [];
        dishes.value = append ? [...dishes.value, ...items] : items;
        currentPage.value = res.data.meta.page;
        hasMore.value = res.data.meta.page < res.data.meta.totalPages;
      } else {
        throw new Error(res.message || '获取菜品列表失败');
      }
    } catch (err) {
      console.error('获取窗口菜品失败:', err);
      localError.value = err instanceof Error ? err.message : '获取菜品信息失败';
    } finally {
      if (append) {
        loadingMore.value = false;
      } else {
        loading.value = false;
      }
    }
  };

  const init = async (windowId: string) => {
    currentPage.value = 1;
    hasMore.value = true;
    await fetchWindow(windowId);
    await fetchDishes(windowId, { page: 1, pageSize });
  };

  const loadMoreDishes = async (windowId: string) => {
    if (loading.value || loadingMore.value) return;
    if (!hasMore.value) return;
    const nextPage = currentPage.value + 1;
    await fetchDishes(windowId, { page: nextPage, pageSize }, { append: true });
  };

  return {
    windowInfo,
    loading,
    loadingMore,
    hasMore,
    error,
    dishes,
    init,
    fetchDishes,
    loadMoreDishes,
    fetchWindow,
  };
};
