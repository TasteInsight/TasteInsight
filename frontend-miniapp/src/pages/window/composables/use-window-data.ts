import { ref, computed } from 'vue';
import { getDishes } from '@/api/modules/dish';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import type { Dish, GetDishesRequest, Window } from '@/types/api';

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
  const dishes = ref<Dish[]>([]);
  const loading = ref(false);
  const error = ref('');
  const activeFilter = ref('');

  const fetchWindow = async (windowId: string) => {
    try {
      await canteenStore.fetchWindowDetail(windowId);
    } catch (err) {
      console.error('通过 store 获取窗口详情失败:', err);
      error.value = '获取窗口信息失败';
    }
  };

  const fetchDishes = async (windowId: string) => {
    loading.value = true;
    error.value = '';
    
    try {
      // 先确保 store 中有窗口信息,以便通过窗口名称筛选菜品
      if (!windowInfo.value) {
        return;
      }
      
      const params: GetDishesRequest = {
        filter: {
          includeOffline: false,
        },
        search: {
          keyword: '',
        },
        sort: {
          field: 'rating',
          order: 'desc',
        },
        pagination: {
          page: 1,
          pageSize: 100,
        },
      };
      
      const response = await getDishes(params);
      // 从分页数据中获取items,并通过窗口名称筛选
      const allDishes = response.data?.items || [];
      dishes.value = allDishes.filter(dish => dish.windowName === windowInfo.value?.name);
    } catch (err) {
      console.error('获取窗口菜品失败:', err);
      error.value = '获取菜品信息失败';
    } finally {
      loading.value = false;
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
