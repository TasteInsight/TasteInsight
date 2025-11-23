import { ref } from 'vue';
import { getCanteenList } from '@/api/modules/canteen';
import { getDishes } from '@/api/modules/dish';
import type { Canteen, Dish, GetDishesRequest } from '@/types/api';

/**
 * 搜索逻辑 Composable
 * 优先级：食堂名 > 菜品名 > 菜品标签
 */
export function useSearch() {
  const keyword = ref('');
  const searchResults = ref<(Canteen | Dish)[]>([]);
  const loading = ref(false);
  const error = ref('');
  const hasSearched = ref(false);

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
    searchResults.value = [];

    try {
      const results: (Canteen | Dish)[] = [];

      // 1. 搜索食堂名称
      const canteenResponse = await getCanteenList({ page: 1, pageSize: 100 });
      if (canteenResponse.code === 200 && canteenResponse.data) {
        const matchedCanteens = canteenResponse.data.items.filter((canteen: Canteen) =>
          canteen.name.toLowerCase().includes(keyword.value.toLowerCase())
        );
        results.push(...matchedCanteens);
      }

      // 2. 搜索菜品名称
      const dishByNameRequest: GetDishesRequest = {
        search: {
          keyword: keyword.value,
          fields: ['name'], // 优先搜索菜品名
        },
        pagination: {
          page: 1,
          pageSize: 50,
        },
      };

      const dishByNameResponse = await getDishes(dishByNameRequest);
      if (dishByNameResponse.code === 200 && dishByNameResponse.data) {
        results.push(...dishByNameResponse.data.items);
      }

      // 3. 如果没有找到结果，从菜品标签中搜索
      if (results.length === 0) {
        const dishByTagRequest: GetDishesRequest = {
          filter: {
            tag: [keyword.value], // 按标签搜索
          },
          pagination: {
            page: 1,
            pageSize: 50,
          },
        };

        const dishByTagResponse = await getDishes(dishByTagRequest);
        if (dishByTagResponse.code === 200 && dishByTagResponse.data) {
          results.push(...dishByTagResponse.data.items);
        }
      }

      searchResults.value = results;

      if (results.length === 0) {
        error.value = '';
      }
    } catch (err: any) {
      console.error('搜索失败:', err);
      error.value = err.message || '搜索失败，请稍后重试';
      searchResults.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * 清空搜索结果
   */
  const clearSearch = () => {
    keyword.value = '';
    searchResults.value = [];
    error.value = '';
    hasSearched.value = false;
  };

  return {
    keyword,
    searchResults,
    loading,
    error,
    hasSearched,
    search,
    clearSearch,
  };
}
