// @/pages/profile/my-favorites/composables/use-favorites.ts
import { ref } from 'vue';
import { getMyFavorites } from '@/api/modules/user';
import { getDishById, unfavoriteDish } from '@/api/modules/dish';
import { useUserStore } from '@/store/modules/use-user-store';
import type { Dish } from '@/types/api';

export function useFavorites() {
  const dishes = ref<Dish[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentPage = ref(1);
  const pageSize = 10;
  const hasMore = ref(true);
  const userStore = useUserStore();

  /**
   * 获取收藏列表
   */
  const fetchFavorites = async (reset = false) => {
    if (loading.value) return;
    
    loading.value = true;
    error.value = null;

    try {
      if (reset) {
        currentPage.value = 1;
        dishes.value = [];
        hasMore.value = true;
      }

      const response = await getMyFavorites({
        page: currentPage.value,
        pageSize,
      });

      if (response.code === 200 && response.data) {
        const { items, meta } = response.data;
        
        // 获取每个收藏对应的菜品详情
        const dishPromises = items.map(item => getDishById(item.dishId));
        const dishResponses = await Promise.all(dishPromises);
        
        const fetchedDishes = dishResponses
          .filter(res => res.code === 200 && res.data)
          .map(res => res.data!);

        if (reset) {
          dishes.value = fetchedDishes;
        } else {
          dishes.value.push(...fetchedDishes);
        }

        // 判断是否还有更多数据
        hasMore.value = currentPage.value < meta.totalPages;
      } else {
        throw new Error(response.message || '获取收藏列表失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取收藏列表失败';
      error.value = message;
      console.error(message, err);
      uni.showToast({
        title: message,
        icon: 'none'
      });
    } finally {
      loading.value = false;
    }
  };

  /**
   * 取消收藏
   */
  const removeFavorite = async (dishId: string) => {
    try {
      const response = await unfavoriteDish(dishId);
      
      if (response.code === 200) {
        // 从列表中移除该菜品
        dishes.value = dishes.value.filter(dish => dish.id !== dishId);
        
        // 更新 userStore 中的本地收藏状态
        const newFavorites = (userStore.userInfo?.myFavoriteDishes || []).filter(id => id !== dishId);
        userStore.updateLocalUserInfo({ myFavoriteDishes: newFavorites });
        
        uni.showToast({
          title: '已取消收藏',
          icon: 'success'
        });
      } else {
        throw new Error(response.message || '取消收藏失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '取消收藏失败';
      console.error(message, err);
      uni.showToast({
        title: message,
        icon: 'none'
      });
    }
  };

  /**
   * 加载更多
   */
  const loadMore = async () => {
    if (!hasMore.value || loading.value) return;
    currentPage.value++;
    await fetchFavorites();
  };

  /**
   * 刷新列表
   */
  const refresh = async () => {
    await fetchFavorites(true);
  };

  return {
    dishes,
    loading,
    error,
    hasMore,
    fetchFavorites,
    loadMore,
    refresh,
    removeFavorite,
  };
}
