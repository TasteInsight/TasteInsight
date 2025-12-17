// @/pages/profile/my-reviews/composables/use-my-reviews.ts
import { ref } from 'vue';
import { getMyReviews } from '@/api/modules/user';
import type { MyReviewItem } from '@/types/api';

export function useMyReviews() {
  const reviews = ref<MyReviewItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentPage = ref(1);
  const pageSize = 10;
  const hasMore = ref(true);

  /**
   * 获取我的评价列表
   */
  const fetchReviews = async (reset = false) => {
    if (loading.value) return;
    
    loading.value = true;
    error.value = null;

    try {
      if (reset) {
        currentPage.value = 1;
        reviews.value = [];
        hasMore.value = true;
      }

      const response = await getMyReviews({
        page: currentPage.value,
        pageSize,
      });

      if (response.code === 200 && response.data) {
        const { items, meta } = response.data;
        
        if (reset) {
          reviews.value = items;
        } else {
          reviews.value.push(...items);
        }

        // 判断是否还有更多数据
        hasMore.value = currentPage.value < meta.totalPages;
      } else {
        throw new Error(response.message || '获取评价列表失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取评价列表失败';
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
   * 加载更多
   */
  const loadMore = async () => {
    if (!hasMore.value || loading.value) return;
    currentPage.value++;
    await fetchReviews();
  };

  /**
   * 刷新列表
   */
  const refresh = async () => {
    await fetchReviews(true);
  };

  return {
    reviews,
    loading,
    error,
    hasMore,
    fetchReviews,
    loadMore,
    refresh,
  };
}
