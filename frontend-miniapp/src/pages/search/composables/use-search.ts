import { ref, computed, watch, getCurrentScope, onScopeDispose, type Ref } from 'vue';
import { getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { Canteen, Window, Dish, GetDishesRequest } from '@/types/api';
import { useUserStore } from '@/store/modules/use-user-store';
import { getPreferredDishSort } from '@/utils/dish-sort';

/**
 * 搜索结果类型
 */
export interface SearchResults {
  canteens: Canteen[];
  windows: Window[];
  dishes: Dish[];
}

export interface SearchScope {
  canteenId?: string;
  windowId?: string;
}

/**
 * 搜索逻辑 Composable
 *
 * 搜索逻辑：
 * 全局搜索优先匹配食堂名称；场所搜索仅查询指定食堂或窗口的菜品。
 * 菜品查询及分页使用已提交的关键词、场所和排序快照。
 */
export function useSearch(scope: Ref<SearchScope> = ref({})) {
  const userStore = useUserStore();
  const keyword = ref('');
  const searchResults = ref<SearchResults>({
    canteens: [],
    windows: [],
    dishes: [],
  });
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref('');
  const canteenError = ref('');
  const loadMoreError = ref('');
  const hasSearched = ref(false);
  const initialized = ref(false);
  const requestToken = ref(0);
  const submittedKeyword = ref('');
  const preferredSort = () =>
    getPreferredDishSort(userStore.userInfo?.settings?.displaySettings?.sortBy);
  let querySort = preferredSort();
  const scopeFilter = computed<GetDishesRequest['filter']>(() => {
    if (scope.value.windowId) return { windowId: [scope.value.windowId] };
    if (scope.value.canteenId) return { canteenId: [scope.value.canteenId] };
    return {};
  });
  let queryFilter: GetDishesRequest['filter'] = {};
  let disposed = false;
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
    });

  // 分页状态
  const page = ref(1);
  const pageSize = ref(20);
  const hasMore = ref(true);

  /**
   * 是否有搜索结果
   */
  const hasResults = computed(() => {
    return (
      searchResults.value.canteens.length > 0 ||
      searchResults.value.windows.length > 0 ||
      searchResults.value.dishes.length > 0
    );
  });

  /**
   * 执行搜索（初始化第一页）
   */
  const search = async (searchTerm = keyword.value.trim(), preserveResults = false) => {
    if (!searchTerm) {
      return;
    }

    const token = ++requestToken.value;
    const session = userStore.sessionVersion;
    const ownsQuery = () =>
      !disposed && token === requestToken.value && session === userStore.sessionVersion;
    const nextFilter = scopeFilter.value;
    const keepResults =
      preserveResults ||
      (searchTerm === submittedKeyword.value &&
        JSON.stringify(queryFilter) === JSON.stringify(nextFilter));
    querySort = preferredSort();
    queryFilter = nextFilter;
    loading.value = true;
    loadingMore.value = false;
    error.value = '';
    canteenError.value = '';
    loadMoreError.value = '';
    hasSearched.value = true;
    if (!keepResults) {
      initialized.value = false;
      searchResults.value = {
        canteens: [],
        windows: [],
        dishes: [],
      };
    }

    // reset pagination
    hasMore.value = false;

    try {
      submittedKeyword.value = searchTerm;
      if (!queryFilter.canteenId && !queryFilter.windowId) {
        const normalized = searchTerm.toLowerCase();
        let allCanteens: Canteen[] = [];
        try {
          // 逐页拉取，避免食堂数量超过单页导致漏匹配
          const first = await getCanteenList({ page: 1, pageSize: 50 });
          if (!ownsQuery()) return;

          if (first.code !== 200 || !first.data)
            throw new Error(first.message || '食堂搜索失败，请重试');
          allCanteens = first.data.items || [];
          const totalPages = first.data.meta?.totalPages ?? 1;
          for (let pageNum = 2; pageNum <= totalPages; pageNum += 1) {
            const next = await getCanteenList({ page: pageNum, pageSize: 50 });
            if (!ownsQuery()) return;
            if (next.code !== 200 || !next.data)
              throw new Error(next.message || '食堂搜索失败，请重试');
            allCanteens = [...allCanteens, ...(next.data.items || [])];
          }
        } catch (e) {
          if (!ownsQuery()) return;
          // 食堂列表失败时继续搜索菜品
          console.error('获取食堂列表失败:', e);
          canteenError.value = e instanceof Error ? e.message : '食堂搜索失败，请重试';
        }

        const matchedCanteens = allCanteens.filter(c =>
          (c.name || '').toLowerCase().includes(normalized)
        );
        if (matchedCanteens.length > 0) {
          searchResults.value = {
            canteens: matchedCanteens,
            windows: [],
            dishes: [],
          };
          hasMore.value = false;
          initialized.value = true;
          return;
        }
      }

      const response = await getDishes({
        filter: { ...queryFilter },
        search: {
          keyword: searchTerm,
        },
        sort: { ...querySort },
        pagination: {
          page: 1,
          pageSize: pageSize.value,
        },
      });

      if (!ownsQuery()) return;

      if (response.code === 200 && response.data) {
        searchResults.value = { canteens: [], windows: [], dishes: response.data.items || [] };
        initialized.value = true;
        // update pagination state
        const meta = response.data.meta || { page: 1, totalPages: 1 };
        page.value = meta.page || 1;
        hasMore.value = (meta.page ?? 1) < (meta.totalPages ?? 1);
      } else {
        error.value = response.message || '搜索失败';
      }
    } catch (err: any) {
      if (!ownsQuery()) return;
      console.error('搜索失败:', err);
      error.value = err.message || '搜索失败，请稍后重试';
    } finally {
      if (ownsQuery()) {
        loading.value = false;
      }
    }
  };

  /**
   * 加载下一页（上拉触发）
   */
  const loadMore = async () => {
    if (!hasSearched.value || loading.value || loadingMore.value || !hasMore.value || error.value)
      return;

    loadingMore.value = true;
    loadMoreError.value = '';
    const nextPage = page.value + 1;
    const token = requestToken.value; // do not bump token for loadMore
    const session = userStore.sessionVersion;
    const ownsQuery = () =>
      !disposed && token === requestToken.value && session === userStore.sessionVersion;

    try {
      const response = await getDishes({
        filter: { ...queryFilter },
        search: { keyword: submittedKeyword.value },
        sort: { ...querySort },
        pagination: { page: nextPage, pageSize: pageSize.value },
      });

      if (!ownsQuery()) return;

      if (response.code === 200 && response.data) {
        const items = response.data.items || [];
        searchResults.value.dishes = [...searchResults.value.dishes, ...items];
        const meta = response.data.meta || { page: nextPage, totalPages: 1 };
        page.value = meta.page || nextPage;
        hasMore.value = (meta.page ?? page.value) < (meta.totalPages ?? 1);
      } else {
        loadMoreError.value = response.message || '加载更多失败，请重试';
      }
    } catch (err) {
      if (!ownsQuery()) return;
      console.error('加载更多失败:', err);
      loadMoreError.value = err instanceof Error ? err.message : '加载更多失败，请重试';
    } finally {
      if (ownsQuery()) loadingMore.value = false;
    }
  };

  /**
   * 清空搜索结果
   */
  const resetResults = () => {
    requestToken.value++;
    submittedKeyword.value = '';
    searchResults.value = {
      canteens: [],
      windows: [],
      dishes: [],
    };
    error.value = '';
    canteenError.value = '';
    loadMoreError.value = '';
    hasSearched.value = false;
    initialized.value = false;
    loading.value = false;
    loadingMore.value = false;
    page.value = 1;
    hasMore.value = true;
  };
  const clearSearch = () => {
    keyword.value = '';
    resetResults();
  };

  const refreshPreferredSort = () => {
    if (hasSearched.value && JSON.stringify(querySort) !== JSON.stringify(preferredSort())) {
      return search(submittedKeyword.value, true);
    }
  };
  const retrySearch = () => search(submittedKeyword.value, true);
  watch(() => userStore.sessionVersion, clearSearch, { flush: 'sync' });

  /**
   * 跳转到添加菜品页面
   */
  const goToAddDish = () => {
    uni.navigateTo({
      url: `/pages/add-dish/index?keyword=${encodeURIComponent(keyword.value)}`,
    });
  };

  return {
    keyword,
    searchResults,
    hasResults,
    loading,
    loadingMore,
    error,
    canteenError,
    loadMoreError,
    submittedKeyword,
    hasSearched,
    initialized,
    page,
    pageSize,
    hasMore,
    search,
    loadMore,
    clearSearch,
    resetResults,
    retrySearch,
    refreshPreferredSort,
    goToAddDish,
  };
}
