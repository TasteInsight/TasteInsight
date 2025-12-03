import { ref } from 'vue';
import { getReviewsByDish, createReview, deleteReview } from '@/api/modules/review';
import type { Review, ReviewCreateRequest } from '@/types/api';

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
