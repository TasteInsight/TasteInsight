import { ref } from 'vue';
import { getDishById } from '@/api/modules/dish';
import { getReviewsByDish } from '@/api/modules/review';
import type { Dish, Review } from '@/types/api';

/**
 * 菜品详情页面逻辑
 */
export function useDishDetail() {
  // --- 菜品详情状态 ---
  const dish = ref<Dish | null>(null);
  const loading = ref(false);
  const error = ref('');

  // --- 子菜品状态 ---
  const subDishes = ref<Dish[]>([]);
  const subDishesLoading = ref(false);

  // --- 评价列表状态 ---
  const reviews = ref<Review[]>([]);
  const reviewsLoading = ref(false);
  const reviewsError = ref('');
  const reviewsHasMore = ref(true);
  const reviewsPage = ref(1);
  const reviewsPageSize = 10;

  /**
   * 获取菜品详情
   */
  const fetchDishDetail = async (dishId: string) => {
    loading.value = true;
    error.value = '';
    // 重置其他状态
    subDishes.value = [];
    reviews.value = [];
    reviewsPage.value = 1;
    reviewsHasMore.value = true;

    try {
      const response = await getDishById(dishId);
      
      if (response.code === 200 && response.data) {
        dish.value = response.data;
        
        // 获取详情成功后，并行获取子菜品和评价
        Promise.all([
          fetchSubDishes(),
          fetchReviews(dishId, true)
        ]);
      } else {
        error.value = response.message || '获取菜品详情失败';
      }
    } catch (err: any) {
      console.error('获取菜品详情失败:', err);
      error.value = err.message || '网络错误，请稍后重试';
    } finally {
      loading.value = false;
    }
  };

  /**
   * 获取子菜品列表
   */
  const fetchSubDishes = async () => {
    const ids = dish.value?.subDishId || [];
    if (!ids || ids.length === 0) {
      subDishes.value = [];
      return;
    }

    subDishesLoading.value = true;
    try {
      const promises = ids.map((id: string) => getDishById(id));
      const results = await Promise.all(promises);
      const items = results
        .filter((r: any) => r && r.code === 200 && r.data)
        .map((r: any) => r.data);
      subDishes.value = items;
    } catch (err) {
      console.error('加载子菜品失败', err);
    } finally {
      subDishesLoading.value = false;
    }
  };

  /**
   * 获取评价列表
   */
  const fetchReviews = async (dishId: string, refresh = false) => {
    if (reviewsLoading.value) return;
    if (!refresh && !reviewsHasMore.value) return;

    reviewsLoading.value = true;
    reviewsError.value = '';

    if (refresh) {
      reviewsPage.value = 1;
      reviews.value = [];
      reviewsHasMore.value = true;
    }

    try {
      const response = await getReviewsByDish(dishId, {
        page: reviewsPage.value,
        pageSize: reviewsPageSize,
      });

      if (response.code === 200 && response.data) {
        const newReviews = response.data.items || [];
        
        if (refresh) {
          reviews.value = newReviews;
        } else {
          reviews.value = [...reviews.value, ...newReviews];
        }

        // 判断是否还有更多数据
        if (newReviews.length < reviewsPageSize) {
          reviewsHasMore.value = false;
        } else {
          reviewsPage.value++;
        }
      } else {
        reviewsError.value = response.message || '获取评价失败';
      }
    } catch (err: any) {
      console.error('获取评价失败:', err);
      reviewsError.value = '网络错误，请稍后重试';
    } finally {
      reviewsLoading.value = false;
    }
  };

  /**
   * 加载更多评价
   */
  const loadMoreReviews = () => {
    if (dish.value?.id) {
      fetchReviews(dish.value.id);
    }
  };

  return {
    dish,
    loading,
    error,
    fetchDishDetail,
    
    subDishes,
    subDishesLoading,
    
    reviews,
    reviewsLoading,
    reviewsError,
    reviewsHasMore,
    fetchReviews,
    loadMoreReviews
  };
}
