import { ref } from 'vue';
import { getDishById } from '@/api/modules/dish';
import type { Dish } from '@/types/api';

/**
 * 菜品详情页面逻辑
 */
export function useDishDetail() {
  const dish = ref<Dish | null>(null);
  const loading = ref(false);
  const error = ref('');

  /**
   * 获取菜品详情
   */
  const fetchDishDetail = async (dishId: string) => {
    loading.value = true;
    error.value = '';

    try {
      const response = await getDishById(dishId);
      
      if (response.code === 200 && response.data) {
        dish.value = response.data;
      } else {
        error.value = response.message || '获取菜品详情失败';
      }
    } catch (err: any) {
      console.error('获取菜品详情失败:', err);
      error.value = err.message || '网络错误，请稍后重试';
    } finally {
      loading.value = false;
    }
  };

  return {
    dish,
    loading,
    error,
    fetchDishDetail,
  };
}
