import { ref, computed } from 'vue';
import { getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { Canteen, Window, Dish } from '@/types/api';

/**
 * 搜索结果类型
 */
export interface SearchResults {
  canteens: Canteen[];
  windows: Window[];
  dishes: Dish[];
}

/**
 * 搜索逻辑 Composable
 *
 * 搜索逻辑：
 * 1) 先获取食堂列表，若关键词匹配到食堂名称，则优先展示食堂卡片
 * 2) 若没有匹配的食堂，再调用 getDishes 搜索菜品（支持分页/上拉加载）
 */
export function useSearch() {
  const keyword = ref('');
  const searchResults = ref<SearchResults>({
    canteens: [],
    windows: [],
    dishes: [],
  });
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref('');
  const hasSearched = ref(false);
  const requestToken = ref(0);

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
  const search = async () => {
    if (!keyword.value.trim()) {
      return;
    }

    loading.value = true;
    error.value = '';
    hasSearched.value = true;
    searchResults.value = {
      canteens: [],
      windows: [],
      dishes: [],
    };

    // reset pagination
    page.value = 1;
    hasMore.value = true;

    try {
      const token = ++requestToken.value;
      const searchTerm = keyword.value.trim();
      const normalized = searchTerm.toLowerCase();

      // 1) 先尝试匹配食堂
      let allCanteens: Canteen[] = [];
      try {
        // 逐页拉取，避免食堂数量超过单页导致漏匹配
        const first = await getCanteenList({ page: 1, pageSize: 50 });
        if (token !== requestToken.value) return;

        if (first.code === 200 && first.data) {
          allCanteens = first.data.items || [];
          const totalPages = first.data.meta?.totalPages ?? 1;
          for (let p = 2; p <= totalPages; p += 1) {
            const next = await getCanteenList({ page: p, pageSize: 50 });
            if (token !== requestToken.value) return;
            if (next.code === 200 && next.data) {
              allCanteens = [...allCanteens, ...(next.data.items || [])];
            } else {
              break;
            }
          }
        }
      } catch (e) {
        // 食堂列表拉取失败时，不中断搜索：继续走菜品搜索作为兜底
        console.error('获取食堂列表失败:', e);
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
        return;
      }

      // 2) 未匹配到食堂，再搜索菜品（第一页）
      const response = await getDishes({
        filter: {},
        search: {
          keyword: searchTerm,
        },
        sort: {},
        pagination: {
          page: page.value,
          pageSize: pageSize.value,
        },
      });

      if (token !== requestToken.value) return;

      if (response.code === 200 && response.data) {
        searchResults.value.dishes = response.data.items || [];
        // update pagination state
        const meta = response.data.meta || { page: page.value, totalPages: 1 };
        page.value = meta.page || page.value;
        hasMore.value = (meta.page ?? 1) < (meta.totalPages ?? 1);
      } else {
        error.value = response.message || '搜索失败';
      }
    } catch (err: any) {
      console.error('搜索失败:', err);
      error.value = err.message || '搜索失败，请稍后重试';
      searchResults.value = {
        canteens: [],
        windows: [],
        dishes: [],
      };
    } finally {
      loading.value = false;
    }
  };

  /**
   * 加载下一页（上拉触发）
   */
  const loadMore = async () => {
    if (!hasSearched.value || loading.value || loadingMore.value || !hasMore.value) return;

    loadingMore.value = true;
    const nextPage = page.value + 1;
    const token = requestToken.value; // do not bump token for loadMore

    try {
      const response = await getDishes({
        filter: {},
        isSuggestion: false,
        search: { keyword: keyword.value.trim() },
        sort: {},
        pagination: { page: nextPage, pageSize: pageSize.value },
      });

      if (token !== requestToken.value) return;

      if (response.code === 200 && response.data) {
        const items = response.data.items || [];
        searchResults.value.dishes = [...searchResults.value.dishes, ...items];
        const meta = response.data.meta || { page: nextPage, totalPages: 1 };
        page.value = meta.page || nextPage;
        hasMore.value = (meta.page ?? page.value) < (meta.totalPages ?? 1);
      }
    } catch (err) {
      console.error('加载更多失败:', err);
    } finally {
      loadingMore.value = false;
    }
  };

  /**
   * 清空搜索结果
   */
  const clearSearch = () => {
    keyword.value = '';
    searchResults.value = {
      canteens: [],
      windows: [],
      dishes: [],
    };
    error.value = '';
    hasSearched.value = false;
    page.value = 1;
    hasMore.value = true;
  };

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
    hasSearched,
    page,
    pageSize,
    hasMore,
    search,
    loadMore,
    clearSearch,
    goToAddDish,
  };
}
