import { ref } from 'vue';
import { getRecommendations, RecommendationScene } from '@/api/modules/recommendation';
import { getDishesByIds } from '@/api/modules/dish';
import type { Dish } from '@/types/api';

/**
 * 推荐菜品 Composable
 * 使用推荐 API 获取个性化推荐
 */
export function useRecommendDishes() {
  const dishes = ref<Dish[]>([]);
  const loading = ref(false);
  const requestId = ref<string | null>(null);
  
  const fetchDishes = async (filter = {}) => {
    if (loading.value) return;
    loading.value = true;

    try {
      // 调用推荐 API
      const response = await getRecommendations({
        scene: RecommendationScene.HOME,
        requestId: requestId.value || undefined,
        filter,
        pagination: {
          page: 1,
          pageSize: 10,
        },
      });

      if (response.code === 200 && response.data) {
        // 保存 requestId 用于分页
        if (response.data.requestId) {
          requestId.value = response.data.requestId;
        }

        // 获取推荐的菜品 ID 列表
        const dishIds = response.data.items.map(item => item.id);
        
        if (dishIds.length > 0) {
          // 批量获取完整的菜品信息
          const dishesResponse = await getDishesByIds(dishIds);

          if (dishesResponse.code === 200 && dishesResponse.data) {
            const fullDishes = dishesResponse.data.items;

            // 按照推荐顺序排序
            dishes.value = dishIds
              .map(id => fullDishes.find(dish => dish.id === id))
              .filter((dish): dish is Dish => dish != null);
          }
        } else {
          dishes.value = [];
        }
      }
    } catch (err) {
      console.error("获取推荐菜品失败:", err);
      dishes.value = [];
    } finally {
      loading.value = false;
    }
  };

  return {
    dishes,
    loading,
    requestId,
    fetchDishes,
  };
}
