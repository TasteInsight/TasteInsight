import { ref, computed, watch, getCurrentScope, onScopeDispose } from 'vue';
import { getDishById, favoriteDish, unfavoriteDish } from '@/api/modules/dish';
import { useUserStore } from '@/store/modules/use-user-store';
import type { Dish } from '@/types/api';
import { useReview } from './use-review';
import { useComment } from './use-comment';

/**
 * 菜品详情页面逻辑
 */
export function useDishDetail() {
  // --- 引入新的 Composables ---
  const {
    reviews,
    ownReview,
    ownReviewLoading,
    ownReviewLoaded,
    ownReviewError,
    fetchOwnReview,
    invalidateOwnReview,
    ratingSummary,
    reviewsLoading,
    reviewsInitialized,
    isInitializing: reviewsInitializing,
    reviewsError,
    reviewsHasMore,
    fetchReviews: fetchReviewsOriginal,
    retryReviews,
    removeReview: removeReviewOriginal,
    submitReview,
  } = useReview();

  const {
    reviewComments,
    fetchComments,
    removeComment: removeCommentOriginal,
    submitComment,
  } = useComment();

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

  // --- 收藏状态 ---
  const userStore = useUserStore();
  const favoriteLoading = ref(false);
  const deletingReview = ref(false);
  let disposed = false;
  let detailVersion = 0;
  let currentDishId = '';
  const captureOperation = () => {
    const session = userStore.sessionVersion;
    return () => !disposed && session === userStore.sessionVersion;
  };

  // 计算当前菜品是否已收藏
  const isFavorited = computed(() => {
    if (!dish.value?.id || !userStore.userInfo?.myFavoriteDishes) return false;
    return userStore.userInfo.myFavoriteDishes.includes(dish.value.id);
  });

  /**
   * 获取菜品详情
   */
  const fetchDishDetail = async (dishId: string, acceptsResult = () => true) => {
    const currentOperation = captureOperation();
    const version = ++detailVersion;
    const isCurrent = () => currentOperation() && version === detailVersion && acceptsResult();
    const loadedPreviewIds = Object.keys(reviewComments.value);
    loading.value = true;
    error.value = '';
    if (currentDishId !== dishId) {
      currentDishId = dishId;
      dish.value = null;
      subDishes.value = [];
      parentDish.value = null;
      subDishesLoading.value = false;
      parentDishLoading.value = false;
    }

    try {
      const response = await getDishById(dishId);
      if (!isCurrent()) return false;

      if (response.code === 200 && response.data) {
        dish.value = response.data;

        // 获取详情成功后，并行获取子菜品、父菜品和评价
        const results = await Promise.all([
          fetchSubDishes(isCurrent),
          fetchParentDish(isCurrent),
          fetchReviewsOriginal(dishId, true, isCurrent),
          fetchOwnReview(dishId, isCurrent),
        ]);
        if (!isCurrent()) return false;
        const visibleReviewIds = new Set(reviews.value.map(review => review.id));
        if (ownReview.value) visibleReviewIds.add(ownReview.value.id);
        await Promise.all(
          loadedPreviewIds
            .filter(reviewId => visibleReviewIds.has(reviewId))
            .map(reviewId => fetchComments(reviewId, true))
        );
        return isCurrent() && results.every(result => result !== false);
      } else {
        error.value = response.message || '获取菜品详情失败';
      }
    } catch (err: any) {
      if (!isCurrent()) return false;
      const debugError =
        err && typeof err === 'object' && 'originalError' in err ? (err as any).originalError : err;
      console.error('获取菜品详情失败:', debugError);
      error.value = err?.message || '网络开小差了，请稍后再试';
    } finally {
      if (isCurrent()) loading.value = false;
    }
    return false;
  };

  /**
   * 获取子菜品列表
   */
  const fetchSubDishes = async (isCurrent: () => boolean): Promise<boolean> => {
    const ids = dish.value?.subDishId || [];
    if (!ids || ids.length === 0) {
      subDishes.value = [];
      return true;
    }

    subDishesLoading.value = true;
    try {
      const promises = ids.map((id: string) => getDishById(id));
      const results = await Promise.all(promises);
      if (!isCurrent()) return false;
      const failed = results.find(result => result.code !== 200 || !result.data);
      if (failed) throw new Error(failed.message || '相关规格加载失败，请重试');
      subDishes.value = results.map(result => result.data!);
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      console.error('加载子菜品失败', err);
      error.value = err instanceof Error ? err.message : '相关规格加载失败，请重试';
      return false;
    } finally {
      if (isCurrent()) subDishesLoading.value = false;
    }
  };

  /**
   * 获取父菜品
   */
  const fetchParentDish = async (isCurrent: () => boolean): Promise<boolean> => {
    const parentId = dish.value?.parentDishId;
    if (!parentId) {
      parentDish.value = null;
      return true;
    }

    parentDishLoading.value = true;
    try {
      const response = await getDishById(parentId);
      if (!isCurrent()) return false;
      if (response.code !== 200 || !response.data)
        throw new Error(response.message || '所属菜品加载失败，请重试');
      parentDish.value = response.data;
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      console.error('加载父菜品失败', err);
      error.value = err instanceof Error ? err.message : '所属菜品加载失败，请重试';
      return false;
    } finally {
      if (isCurrent()) parentDishLoading.value = false;
    }
  };

  /**
   * 加载更多评价
   */
  const loadMoreReviews = () => {
    if (dish.value?.id) {
      return fetchReviewsOriginal(dish.value.id);
    }
  };

  /**
   * 删除评价 (包装一层以处理 UI 反馈和更新菜品评价数)
   */
  const removeReview = async (reviewId: string, onSuccess?: () => void) => {
    if (deletingReview.value) return false;
    const isCurrent = captureOperation();
    const dishId = dish.value?.id;
    deletingReview.value = true;
    try {
      if (!(await removeReviewOriginal(reviewId)) || !isCurrent()) return false;
      if (dishId && dish.value?.id === dishId) await fetchDishDetail(dishId);
      if (!isCurrent()) return false;
      onSuccess?.();
      uni.showToast({ title: '删除成功', icon: 'success' });
      return true;
    } catch (err: any) {
      if (isCurrent()) uni.showToast({ title: err.message || '删除失败', icon: 'none' });
      return false;
    } finally {
      if (isCurrent()) deletingReview.value = false;
    }
  };

  /**
   * 删除评论 (包装一层以处理 UI 反馈)
   */
  const removeComment = async (commentId: string, reviewId: string) => {
    try {
      await removeCommentOriginal(commentId, reviewId);
      // 刷新该条评价的评论列表
      if (reviewId) {
        await fetchComments(reviewId);
      }
      uni.showToast({ title: '删除成功', icon: 'success' });
    } catch (err: any) {
      uni.showToast({ title: err.message || '删除失败', icon: 'none' });
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
    const isCurrent = captureOperation();

    try {
      if (isFavorited.value) {
        // 取消收藏
        const res = await unfavoriteDish(dishId);
        if (!isCurrent()) return;
        if (res.code === 200) {
          // 更新本地用户信息
          const newFavorites = (userStore.userInfo?.myFavoriteDishes || []).filter(
            id => id !== dishId
          );
          userStore.updateLocalUserInfo({ myFavoriteDishes: newFavorites });
          uni.showToast({ title: '已取消收藏', icon: 'none' });
        } else {
          uni.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      } else {
        // 添加收藏
        const res = await favoriteDish(dishId);
        if (!isCurrent()) return;
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
      if (!isCurrent()) return;
      console.error('收藏操作失败', err);
      uni.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      if (isCurrent()) favoriteLoading.value = false;
    }
  };

  watch(
    () => userStore.sessionVersion,
    () => {
      detailVersion++;
      currentDishId = '';
      dish.value = null;
      subDishes.value = [];
      parentDish.value = null;
      favoriteLoading.value = false;
      deletingReview.value = false;
      loading.value = false;
      error.value = '';
    },
    { flush: 'sync' }
  );
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
    });

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
    ownReview,
    ownReviewLoading,
    ownReviewLoaded,
    ownReviewError,
    fetchOwnReview,
    invalidateOwnReview,
    deletingReview,
    ratingSummary,
    reviewsLoading,
    reviewsInitialized,
    reviewsInitializing,
    reviewsError,
    reviewsHasMore,
    fetchReviews: fetchReviewsOriginal,
    retryReviews,
    loadMoreReviews,
    submitReview,

    reviewComments,
    fetchComments,
    submitComment,

    removeReview,
    removeComment,

    isFavorited,
    favoriteLoading,
    toggleFavorite,
  };
}
