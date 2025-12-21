import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  getDishes, 
  getDishById,
  favoriteDish,
  unfavoriteDish,
  uploadDish
} from '@/api/modules/dish';
import type { 
  Dish, 
  PaginationMeta,
  GetDishesRequest,
  DishUserCreateRequest,
  DishUploadData,
  ApiResponse,
  SuccessResponse
} from '@/types/api';
import { toUserFriendlyErrorMessage } from '@/utils/user-friendly-error';

// 为 state 定义一个类型，增强类型安全
interface DishesState {
  dishes: Dish[];
  currentDish: Dish | null;
  pagination: PaginationMeta | null;
  loading: boolean;
  error: string | null;
}

export const useDishesStore = defineStore('dishes', () => {
  // ==================== State ====================
  
  // 菜品列表
  const dishes = ref<Dish[]>([]);
  // 当前查看的菜品详情
  const currentDish = ref<Dish | null>(null);
  // 分页元信息
  const pagination = ref<PaginationMeta | null>(null);
  // 加载状态
  const loading = ref(false);
  // 错误信息
  const error = ref<string | null>(null);

  // ==================== Getters ====================

  /**
   * 是否有菜品数据
   */
  const hasDishes = computed(() => dishes.value.length > 0);
  
  /**
   * 总页数
   */
  const totalPages = computed(() => pagination.value?.totalPages ?? 0);

  // ==================== Actions ====================

  /**
   * 获取菜品列表 (支持筛选、搜索、排序和分页)
   * @param {GetDishesRequest} params - 请求参数
   */
  async function fetchDishes(params: GetDishesRequest): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await getDishes(params);
      
      if (response.code === 200 && response.data) {
        dishes.value = response.data.items;
        pagination.value = response.data.meta;
      } else {
        throw new Error(response.message || '获取菜品列表失败');
      }
    } catch (err) {
      error.value = toUserFriendlyErrorMessage(err);
      console.error('获取菜品列表失败:', err);
      // 抛出错误以便 UI 层可以捕获
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取单个菜品详情
   * @param {string} id - 菜品ID
   */
  async function fetchDishById(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    currentDish.value = null; // 先清空旧数据
    try {
      const response = await getDishById(id);
      
      if (response.code === 200 && response.data) {
        currentDish.value = response.data;
      } else {
        throw new Error(response.message || '获取菜品详情失败');
      }
    } catch (err) {
      error.value = toUserFriendlyErrorMessage(err);
      console.error(`获取ID为 ${id} 的菜品详情失败:`, err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 收藏菜品
   * @param {string} dishId - 菜品ID
   */
  async function favorite(dishId: string): Promise<boolean> {
    try {
      const response = await favoriteDish(dishId);
      if (response.code === 200) {
        // 可以在这里更新菜品状态，例如:
        // const dish = dishes.value.find(d => d.id === dishId);
        // if (dish) dish.isFavorited = true;
        uni.showToast({ title: '收藏成功', icon: 'success' });
        return true;
      } else {
        throw new Error(response.message || '收藏失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '收藏操作失败';
      console.error(message, err);
      uni.showToast({ title: message, icon: 'none' });
      return false;
    }
  }

  /**
   * 取消收藏菜品
   * @param {string} dishId - 菜品ID
   */
  async function unfavorite(dishId: string): Promise<boolean> {
    try {
      const response = await unfavoriteDish(dishId);
       if (response.code === 200) {
        // 更新菜品状态
        uni.showToast({ title: '已取消收藏', icon: 'success' });
        return true;
      } else {
        throw new Error(response.message || '取消收藏失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '取消收藏操作失败';
      console.error(message, err);
      uni.showToast({ title: message, icon: 'none' });
      return false;
    }
  }
  
  /**
   * 用户上传新菜品
   * @param {DishUserCreateRequest} dishData - 菜品数据
   */
  async function upload(dishData: DishUserCreateRequest): Promise<DishUploadData | null> {
    loading.value = true;
    error.value = null;
    try {
      const response = await uploadDish(dishData);
      if (response.code === 201 && response.data) {
         uni.showToast({ title: '上传成功，等待审核', icon: 'success' });
         return response.data;
      } else {
        throw new Error(response.message || '上传失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传操作失败';
      error.value = message;
      console.error(message, err);
      uni.showToast({ title: message, icon: 'none' });
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 清空当前菜品详情
   */
  function clearCurrentDish(): void {
    currentDish.value = null;
  }

  return {
    // State
    dishes,
    currentDish,
    pagination,
    loading,
    error,
    
    // Getters
    hasDishes,
    totalPages,
    
    // Actions
    fetchDishes,
    fetchDishById,
    favorite,
    unfavorite,
    upload,
    clearCurrentDish,
  };
});