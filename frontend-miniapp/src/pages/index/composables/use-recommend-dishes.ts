import { ref } from 'vue';
import { getDishes } from '@/api/modules/dish';
import type { Dish, GetDishesRequest } from '@/types/api';

export function useRecommendDishes() {
  const dishes = ref<Dish[]>([]);
  const loading = ref(false);
  
  const fetchDishes = async () => {
    if (loading.value) return;
    loading.value = true;
    
    try {
      const requestParams: GetDishesRequest = {
        sort: {
          field: 'averageRating',
          order: 'desc',
        },
        pagination: {
          page: 1,
          pageSize: 10,
        },
        filter: {}, 
        search: { keyword: '' },
      };
      
      const paginatedData = await getDishes(requestParams);
      dishes.value = paginatedData.data.items;

    } catch (err) {
      console.error("获取推荐菜品失败:", err);
    } finally {
      loading.value = false;
    }
  };

  return {
    dishes,
    loading,
    fetchDishes,
  };
}