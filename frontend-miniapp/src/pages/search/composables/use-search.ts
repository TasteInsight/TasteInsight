import { ref, computed } from 'vue';
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
 * 搜索逻辑完全由后端接管：
 * 1. 调用 getDishes 接口，传入 keyword
 * 2. 后端会在 name, description, tags, canteen, window 中进行搜索
 * 3. 前端只负责展示结果
 */
export function useSearch() {
  const keyword = ref('');
  const searchResults = ref<SearchResults>({
    canteens: [],
    windows: [],
    dishes: [],
  });
  const loading = ref(false);
  const error = ref('');
  const hasSearched = ref(false);

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
   * 执行搜索
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

    try {
      const searchTerm = keyword.value.trim();
      
      // 调用后端搜索接口
      // 不传入 fields，后端默认在 name, description, tags, canteen, window 中搜索
      const response = await getDishes({
        filter: {},
        isSuggestion: false,
        search: {
          keyword: searchTerm,
        },
        sort: {},
        pagination: {
          page: 1,
          pageSize: 50,
        },
      });

      if (response.code === 200 && response.data) {
        searchResults.value.dishes = response.data.items;
        // 目前后端接口只返回菜品，暂不处理食堂和窗口的独立搜索结果
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
    error,
    hasSearched,
    search,
    clearSearch,
    goToAddDish,
  };
}
