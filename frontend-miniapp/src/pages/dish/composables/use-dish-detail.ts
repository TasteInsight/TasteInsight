import { ref, computed } from 'vue';
import { getDishById, favoriteDish, unfavoriteDish } from '@/api/modules/dish';
import { getReviewsByDish, deleteReview } from '@/api/modules/review';
import { getCommentsByReview, deleteComment } from '@/api/modules/comment';
import { useUserStore } from '@/store/modules/use-user-store';
import type { Dish, Review, Comment } from '@/types/api';

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

  // --- 父菜品状态 ---
  const parentDish = ref<Dish | null>(null);
  const parentDishLoading = ref(false);

  // --- 评价列表状态 ---
  const reviews = ref<Review[]>([]);
  const reviewsLoading = ref(false);
  const reviewsError = ref('');
  const reviewsHasMore = ref(true);
  const reviewsPage = ref(1);
  const reviewsPageSize = 10;

  // --- 评论状态 (按 reviewId 存储) ---
  const reviewComments = ref<Record<string, { 
    items: Comment[], 
    total: number, 
    loading: boolean 
  }>>({});

  // --- 收藏状态 ---
  const userStore = useUserStore();
  const favoriteLoading = ref(false);
  
  // 计算当前菜品是否已收藏
  const isFavorited = computed(() => {
    if (!dish.value?.id || !userStore.userInfo?.myFavoriteDishes) return false;
    return userStore.userInfo.myFavoriteDishes.includes(dish.value.id);
  });

  /**
   * 获取菜品详情
   */
  const fetchDishDetail = async (dishId: string) => {
    loading.value = true;
    error.value = '';
    // 重置其他状态
    subDishes.value = [];
    parentDish.value = null;
    reviews.value = [];
    reviewsPage.value = 1;
    reviewsHasMore.value = true;
    reviewComments.value = {}; // 重置评论缓存

    try {
      const response = await getDishById(dishId);
      
      if (response.code === 200 && response.data) {
        dish.value = response.data;
        
        // 获取详情成功后，并行获取子菜品、父菜品和评价
        await Promise.all([
          fetchSubDishes(),
          fetchParentDish(),
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
   * 获取父菜品
   */
  const fetchParentDish = async () => {
    const parentId = dish.value?.parentDishId;
    if (!parentId) {
      parentDish.value = null;
      return;
    }

    parentDishLoading.value = true;
    try {
      const response = await getDishById(parentId);
      if (response.code === 200 && response.data) {
        parentDish.value = response.data;
      }
    } catch (err) {
      console.error('加载父菜品失败', err);
    } finally {
      parentDishLoading.value = false;
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
   * 获取某条评价的评论
   */
  const fetchComments = async (reviewId: string) => {
    // 如果正在加载，则跳过
    if (reviewComments.value[reviewId]?.loading) return;

    // 初始化状态
    if (!reviewComments.value[reviewId]) {
      reviewComments.value[reviewId] = { items: [], total: 0, loading: true };
    } else {
      reviewComments.value[reviewId].loading = true;
    }

    try {
      // 列表页只展示前5条
      const res = await getCommentsByReview(reviewId, { page: 1, pageSize: 5 });
      if (res.code === 200 && res.data) {
        reviewComments.value[reviewId] = {
          items: res.data.items || [],
          total: res.data.meta?.total || 0,
          loading: false
        };
      }
    } catch (e) {
      console.error('获取评论失败', e);
      reviewComments.value[reviewId].loading = false;
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

  /**
   * 删除评价
   */
  const removeReview = async (reviewId: string) => {
    try {
      const res = await deleteReview(reviewId);
      if (res.code === 200) {
        // 从列表中移除
        reviews.value = reviews.value.filter(r => r.id !== reviewId);
        // 更新菜品评价数
        if (dish.value && dish.value.reviewCount) {
          dish.value.reviewCount--;
        }
        uni.showToast({ title: '删除成功', icon: 'success' });
      } else {
        uni.showToast({ title: res.message || '删除失败', icon: 'none' });
      }
    } catch (err) {
      console.error('删除评价失败', err);
      uni.showToast({ title: '网络错误', icon: 'none' });
    }
  };

  /**
   * 删除评论
   */
  const removeComment = async (commentId: string, reviewId: string) => {
    try {
      const res = await deleteComment(commentId);
      if (res.code === 200) {
        // 从缓存中移除
        if (reviewComments.value[reviewId]) {
          const comments = reviewComments.value[reviewId];
          comments.items = comments.items.filter(c => c.id !== commentId);
          comments.total--;
        }
        uni.showToast({ title: '删除成功', icon: 'success' });
      } else {
        uni.showToast({ title: res.message || '删除失败', icon: 'none' });
      }
    } catch (err) {
      console.error('删除评论失败', err);
      uni.showToast({ title: '网络错误', icon: 'none' });
    }
  };

  /**
   * 切换收藏状态
   */
  const toggleFavorite = async () => {
    if (!dish.value?.id) return;
    if (!userStore.isLoggedIn) {
      uni.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    if (favoriteLoading.value) return;

    favoriteLoading.value = true;
    const dishId = dish.value.id;

    try {
      if (isFavorited.value) {
        // 取消收藏
        const res = await unfavoriteDish(dishId);
        if (res.code === 200) {
          // 更新本地用户信息
          const newFavorites = (userStore.userInfo?.myFavoriteDishes || []).filter(id => id !== dishId);
          userStore.updateLocalUserInfo({ myFavoriteDishes: newFavorites });
          uni.showToast({ title: '已取消收藏', icon: 'none' });
        } else {
          uni.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      } else {
        // 添加收藏
        const res = await favoriteDish(dishId);
        if (res.code === 200) {
          // 更新本地用户信息
          const newFavorites = [...(userStore.userInfo?.myFavoriteDishes || []), dishId];
          userStore.updateLocalUserInfo({ myFavoriteDishes: newFavorites });
          uni.showToast({ title: '收藏成功', icon: 'success' });
        } else {
          uni.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      }
    } catch (err) {
      console.error('收藏操作失败', err);
      uni.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      favoriteLoading.value = false;
    }
  };

  return {
    dish,
    loading,
    error,
    fetchDishDetail,
    
    subDishes,
    subDishesLoading,
    
    parentDish,
    parentDishLoading,
    
    reviews,
    reviewsLoading,
    reviewsError,
    reviewsHasMore,
    fetchReviews,
    loadMoreReviews,

    reviewComments,
    fetchComments,
    
    removeReview,
    removeComment,
    
    isFavorited,
    favoriteLoading,
    toggleFavorite
  };
}

