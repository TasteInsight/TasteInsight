// @/pages/profile/my-favorites/composables/use-favorites.ts
import { ref } from 'vue';
import { getMyFavorites } from '@/api/modules/user';
import { unfavoriteDish } from '@/api/modules/dish';
import type { Favorite } from '@/types/api';

export function useFavorites() {
  const favoriteItems = ref<Favorite[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentPage = ref(1);
  const pageSize = 10;
  const hasMore = ref(true);

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
        favoriteItems.value = [];
        hasMore.value = true;
      }

      const response = await getMyFavorites({
        page: currentPage.value,
        pageSize,
      });

      if (response.code === 200 && response.data) {
        const { items, meta } = response.data;

        // 收藏列表已经包含了菜品详情
        if (reset) {
          favoriteItems.value = items;
        } else {
          favoriteItems.value.push(...items);
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
        favoriteItems.value = favoriteItems.value.filter(item => item.dishId !== dishId);

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
    favoriteItems,
    loading,
    error,
    hasMore,
    fetchFavorites,
    loadMore,
    refresh,
    removeFavorite,
  };
}
