import { ref, computed } from 'vue';
import { getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { Canteen, Window, Dish, GetDishesRequest } from '@/types/api';

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
 * 优先级：食堂名称 > 窗口名称 > 菜品名字 > 菜品tag
 * 
 * 注意：当前实现同时兼容 Mock 数据和真实接口
 * - Mock 模式：前端过滤确保结果准确
 * - 真实接口：依赖后端搜索，前端过滤作为保险
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
   * 前端过滤 - 确保搜索结果准确性
   * 无论后端返回什么，都在前端做一次过滤保证结果匹配搜索词
   */
  const filterByKeyword = <T extends { name: string }>(
    items: T[],
    searchTerm: string
  ): T[] => {
    if (!searchTerm) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

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
      const searchTermLower = searchTerm.toLowerCase();
      
      // 并行请求食堂列表和菜品列表，提高搜索效率
      const [canteenResponse, dishResponse] = await Promise.all([
        // 获取食堂列表（未来可改为带 keyword 参数的搜索接口）
        getCanteenList({ page: 1, pageSize: 100 }),
        // 搜索菜品（后端支持 keyword 搜索）
        getDishes({
          filter: {},
          search: {
            keyword: searchTerm,
            fields: ['name'],
          },
          sort: {},
          pagination: {
            page: 1,
            pageSize: 50,
          },
        } as GetDishesRequest),
      ]);

      const matchedCanteens: Canteen[] = [];
      const matchedWindows: (Window & { canteenId: string; canteenName: string })[] = [];
      let matchedDishes: Dish[] = [];

      // 1. 处理食堂和窗口搜索结果
      if (canteenResponse.code === 200 && canteenResponse.data) {
        for (const canteen of canteenResponse.data.items) {
          // 匹配食堂名称
          if (canteen.name.toLowerCase().includes(searchTermLower)) {
            matchedCanteens.push(canteen);
          }
          
          // 匹配窗口名称
          if (canteen.windows) {
            for (const window of canteen.windows) {
              if (window.name.toLowerCase().includes(searchTermLower)) {
                matchedWindows.push({
                  ...window,
                  canteenId: canteen.id,
                  canteenName: canteen.name,
                });
              }
            }
          }
        }
      }

      // 2. 处理菜品搜索结果
      if (dishResponse.code === 200 && dishResponse.data) {
        // 前端过滤确保结果准确（兼容 Mock 和真实接口）
        matchedDishes = dishResponse.data.items.filter(dish => 
          dish.name.toLowerCase().includes(searchTermLower)
        );
      }

      // 3. 如果菜品名称没找到，尝试按标签搜索
      if (matchedDishes.length === 0 && matchedCanteens.length === 0 && matchedWindows.length === 0) {
        const tagResponse = await getDishes({
          filter: {
            tag: [searchTerm],
          },
          search: {
            keyword: '',
          },
          sort: {},
          pagination: {
            page: 1,
            pageSize: 50,
          },
        } as GetDishesRequest);

        if (tagResponse.code === 200 && tagResponse.data) {
          // 前端过滤确保标签匹配
          matchedDishes = tagResponse.data.items.filter(dish =>
            dish.tags?.some(tag => tag.toLowerCase().includes(searchTermLower))
          );
        }
      }

      searchResults.value = {
        canteens: matchedCanteens,
        windows: matchedWindows,
        dishes: matchedDishes,
      };

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
