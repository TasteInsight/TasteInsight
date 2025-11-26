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
      const searchTerm = keyword.value.toLowerCase().trim();
      const matchedCanteens: Canteen[] = [];
      const matchedWindows: Window[] = [];
      const matchedDishes: Dish[] = [];

      // 1. 搜索食堂名称
      const canteenResponse = await getCanteenList({ page: 1, pageSize: 100 });
      if (canteenResponse.code === 200 && canteenResponse.data) {
        for (const canteen of canteenResponse.data.items) {
          if (canteen.name.toLowerCase().includes(searchTerm)) {
            matchedCanteens.push(canteen);
          }
          
          // 2. 搜索窗口名称（窗口在食堂数据中）
          if (canteen.windows) {
            for (const window of canteen.windows) {
              if (window.name.toLowerCase().includes(searchTerm)) {
                // 给窗口添加食堂信息，方便跳转
                matchedWindows.push({
                  ...window,
                  canteenId: canteen.id,
                  canteenName: canteen.name,
                } as Window & { canteenId: string; canteenName: string });
              }
            }
          }
        }
      }

      // 3. 搜索菜品名称 - 只有当食堂和窗口都没有匹配时才搜索菜品
      if (matchedCanteens.length === 0 && matchedWindows.length === 0) {
        const dishByNameRequest: GetDishesRequest = {
          filter: {},
          search: {
            keyword: keyword.value,
            fields: ['name'],
          },
          sort: {},
          pagination: {
            page: 1,
            pageSize: 50,
          },
        };

        const dishByNameResponse = await getDishes(dishByNameRequest);
        if (dishByNameResponse.code === 200 && dishByNameResponse.data) {
          // 过滤确保只返回名称匹配的菜品
          const filteredDishes = dishByNameResponse.data.items.filter(dish => 
            dish.name.toLowerCase().includes(searchTerm)
          );
          matchedDishes.push(...filteredDishes);
        }

        // 4. 如果菜品名称没找到，搜索菜品标签
        if (matchedDishes.length === 0) {
          const dishByTagRequest: GetDishesRequest = {
            filter: {
              tag: [keyword.value],
            },
            search: {
              keyword: '',
            },
            sort: {},
            pagination: {
              page: 1,
              pageSize: 50,
            },
          };

          const dishByTagResponse = await getDishes(dishByTagRequest);
          if (dishByTagResponse.code === 200 && dishByTagResponse.data) {
            // 过滤确保只返回标签匹配的菜品
            const filteredDishes = dishByTagResponse.data.items.filter(dish =>
              dish.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
            );
            matchedDishes.push(...filteredDishes);
          }
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
