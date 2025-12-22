// @/pages/profile/history/composables/use-history.ts
import { ref } from 'vue';
import { getBrowseHistory } from '@/api/modules/user';
import { getDishById } from '@/api/modules/dish';
import type { Dish } from '@/types/api';

export function useHistory() {
  const dishes = ref<Dish[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentPage = ref(1);
  const pageSize = 10;
  const hasMore = ref(true);

  /**
   * 获取浏览历史列表
   */
  const fetchHistory = async (reset = false) => {
    if (loading.value) return;
    
    loading.value = true;
    error.value = null;

    try {
      if (reset) {
        currentPage.value = 1;
        dishes.value = [];
        hasMore.value = true;
      }

      const response = await getBrowseHistory({
        page: currentPage.value,
        pageSize,
      });

      if (response.code === 200 && response.data) {
        const { items, meta } = response.data;
        
        // 获取每个历史记录对应的菜品详情
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
        throw new Error(response.message || '获取浏览历史失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取浏览历史失败';
      error.value = message;
      console.error(message, err);
      uni.showToast({
        title: message,
        icon: 'none'
      });
      // 加载失败时，认为没有更多数据
      hasMore.value = false;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 加载更多
   */
  const loadMore = async () => {
    if (!hasMore.value || loading.value) return;
    currentPage.value++;
    await fetchHistory();
  };

  /**
   * 刷新列表
   */
  const refresh = async () => {
    await fetchHistory(true);
  };

  return {
    dishes,
    loading,
    error,
    hasMore,
    fetchHistory,
    loadMore,
    refresh,
  };
}
