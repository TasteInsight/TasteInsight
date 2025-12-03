import { ref, computed, watch } from 'vue';
import { getReviewsByDish, createReview, deleteReview } from '@/api/modules/review';
import type { Review, ReviewCreateRequest } from '@/types/api';

type FlavorKey = 'spicyLevel' | 'sweetness' | 'saltiness' | 'oiliness';

/**
 * 评价列表相关逻辑
 */
export function useReview() {
  const reviews = ref<Review[]>([]);
  const reviewsLoading = ref(false);
  const reviewsError = ref('');
  const reviewsHasMore = ref(true);
  const reviewsPage = ref(1);
  const reviewsPageSize = 10;

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
   * 提交评价
   */
  const submitReview = async (payload: ReviewCreateRequest) => {
    try {
      const response = await createReview(payload);
      if (response.code === 200) {
        return response.data;
      } else {
        throw new Error(response.message || '提交失败');
      }
    } catch (err: any) {
      console.error('提交评价失败:', err);
      throw err;
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
        return true;
      } else {
        throw new Error(res.message || '删除失败');
      }
    } catch (err) {
      console.error('删除评价失败', err);
      throw err;
    }
  };

  return {
    reviews,
    reviewsLoading,
    reviewsError,
    reviewsHasMore,
    fetchReviews,
    submitReview,
    removeReview
  };
}

/**
 * 评价表单相关逻辑
 */
export function useReviewForm() {
  const rating = ref(0);
  const content = ref('');
  const submitting = ref(false);
  const showFlavorError = ref(false);

  const flavorOptions: Array<{ key: FlavorKey; label: string; hint: string }> = [
    { key: 'spicyLevel', label: '辣度', hint: '辣味程度' },
    { key: 'sweetness', label: '甜度', hint: '甜味浓淡' },
    { key: 'saltiness', label: '咸度', hint: '咸味强度' },
    { key: 'oiliness', label: '油腻程度', hint: '油脂感' },
  ];

  const flavorRatings = ref<Record<FlavorKey, number>>({
    spicyLevel: 0,
    sweetness: 0,
    saltiness: 0,
    oiliness: 0,
  });

  const hasFlavorSelection = computed(() =>
    Object.values(flavorRatings.value).some(value => value > 0)
  );

  const flavorSelectionComplete = computed(() =>
    !hasFlavorSelection.value || Object.values(flavorRatings.value).every(value => value > 0)
  );

  const ratingText = computed(() => {
    const texts = ['请选择评分', '非常差', '差', '一般', '好', '非常好'];
    return texts[rating.value] || texts[0];
  });

  const setRating = (star: number) => {
    rating.value = star;
  };

  const setFlavorRating = (key: FlavorKey, value: number) => {
    showFlavorError.value = false;
    flavorRatings.value[key] = flavorRatings.value[key] === value ? 0 : value;
  };

  const resetFlavorRatings = () => {
    flavorRatings.value = {
      spicyLevel: 0,
      sweetness: 0,
      saltiness: 0,
      oiliness: 0,
    };
    showFlavorError.value = false;
  };

  const resetForm = () => {
    rating.value = 0;
    content.value = '';
    resetFlavorRatings();
  };

  // 当主评分清空时重置口味评分
  watch(rating, (value) => {
    if (value === 0) {
      resetFlavorRatings();
    }
  });

  /**
   * 保存评价状态到本地存储
   */
  const saveReviewState = (dishId: string) => {
    const state = {
      rating: rating.value,
      content: content.value,
      flavorRatings: { ...flavorRatings.value },
      timestamp: Date.now(),
    };
    uni.setStorageSync(`review_state_${dishId}`, state);
  };

  /**
   * 从本地存储恢复评价状态
   */
  const loadReviewState = (dishId: string) => {
    try {
      const state = uni.getStorageSync(`review_state_${dishId}`);
      if (state && typeof state === 'object') {
        // 检查是否过期（24小时）
        const now = Date.now();
        if (now - state.timestamp < 24 * 60 * 60 * 1000) {
          rating.value = state.rating || 0;
          content.value = state.content || '';
          flavorRatings.value = state.flavorRatings ? { ...state.flavorRatings } : {
            spicyLevel: 0,
            sweetness: 0,
            saltiness: 0,
            oiliness: 0,
          };
          return true;
        }
      }
    } catch (error) {
      console.log('恢复评价状态失败:', error);
    }
    return false;
  };

  /**
   * 清除保存的评价状态
   */
  const clearReviewState = (dishId: string) => {
    uni.removeStorageSync(`review_state_${dishId}`);
  };

  /**
   * 检查是否有保存的评价状态
   */
  const hasSavedReviewState = (dishId: string) => {
    try {
      const state = uni.getStorageSync(`review_state_${dishId}`);
      if (state && typeof state === 'object') {
        const now = Date.now();
        return now - state.timestamp < 24 * 60 * 60 * 1000;
      }
    } catch (error) {
      console.log('检查评价状态失败:', error);
    }
    return false;
  };

  /**
   * 提交评价
   */
  const handleSubmit = async (dishId: string, onSuccess?: () => void) => {
    if (submitting.value) return;

    submitting.value = true;

    try {
      if (rating.value === 0) {
        uni.showToast({
          title: '请先选择总体评分',
          icon: 'none',
        });
        submitting.value = false;
        return;
      }

      if (!flavorSelectionComplete.value) {
        showFlavorError.value = true;
        submitting.value = false;
        uni.showToast({
          title: '请选择全部口味评分或全部留空',
          icon: 'none',
        });
        return;
      }

      const payload: ReviewCreateRequest = {
        dishId,
        rating: rating.value,
        content: content.value.trim(),
      };

      if (hasFlavorSelection.value) {
        payload.ratingDetails = { ...flavorRatings.value };
      }

      const response = await createReview(payload);

      if (response.code === 200) {
        resetForm();
        onSuccess?.();
      } else {
        uni.showToast({
          title: response.message || '提交失败',
          icon: 'none',
        });
      }
    } catch (err: any) {
      console.error('提交评价失败:', err);
      uni.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none',
      });
    } finally {
      submitting.value = false;
    }
  };

  return {
    rating,
    content,
    submitting,
    showFlavorError,
    flavorOptions,
    flavorRatings,
    hasFlavorSelection,
    flavorSelectionComplete,
    ratingText,
    setRating,
    setFlavorRating,
    resetFlavorRatings,
    resetForm,
    saveReviewState,
    loadReviewState,
    clearReviewState,
    hasSavedReviewState,
    handleSubmit
  };
}
