// @/pages/profile/history/composables/use-history.ts
import { ref } from 'vue';
import { getBrowseHistory } from '@/api/modules/user';
import type { BrowseHistoryItem } from '@/types/api';

export function useHistory() {
  const historyItems = ref<BrowseHistoryItem[]>([]);
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
        historyItems.value = [];
        hasMore.value = true;
      }

      const response = await getBrowseHistory({
        page: currentPage.value,
        pageSize,
      });

      if (response.code === 200 && response.data) {
        const { items, meta } = response.data;

        // 历史记录已经包含了菜品详情
        if (reset) {
          historyItems.value = items;
        } else {
          historyItems.value.push(...items);
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
    historyItems,
    loading,
    error,
    hasMore,
    fetchHistory,
    loadMore,
    refresh,
  };
}
