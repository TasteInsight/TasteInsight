import { ref, computed, watch, getCurrentScope, onScopeDispose } from 'vue';
import { getReviewsByDish, createReview, deleteReview } from '@/api/modules/review';
import { uploadImage } from '@/api/modules/upload';
import { useUserStore } from '@/store/modules/use-user-store';
import type { Review, ReviewCreateRequest, ReviewListData } from '@/types/api';

const REVIEW_STATE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时过期时间
const IMAGE_DRAFT_UNAVAILABLE = new Error('当前平台不支持图片草稿，可继续编辑或提交');

type FlavorKey = 'spicyLevel' | 'sweetness' | 'saltiness' | 'oiliness';

type ReviewImage = { source: 'temporary' | 'saved' | 'remote'; path: string };
type ReviewState = {
  rating: number;
  content: string;
  images: ReviewImage[];
  flavorRatings: Record<FlavorKey, number>;
  timestamp: number;
};

const saveLocalImage = (tempFilePath: string): Promise<string> => {
  const fileSystem = uni.getFileSystemManager?.();
  if (!fileSystem?.saveFile) {
    return Promise.reject(IMAGE_DRAFT_UNAVAILABLE);
  }
  return new Promise((resolve, reject) => {
    fileSystem.saveFile({
      tempFilePath,
      success: result => resolve(result.savedFilePath),
      fail: reject,
    });
  });
};

const removeLocalImages = (paths: Iterable<string>) => {
  for (const filePath of new Set(paths)) {
    try {
      uni.getFileSystemManager().removeSavedFile({
        filePath,
        fail: error => console.warn('清理评价草稿图片失败:', error),
      });
    } catch (error) {
      console.warn('清理评价草稿图片失败:', error);
    }
  }
};

const savedImagePaths = (state?: ReviewState) =>
  (state?.images || []).filter(image => image.source === 'saved').map(image => image.path);

/**
 * 评价列表相关逻辑
 */
export function useReview() {
  const reviews = ref<Review[]>([]);
  const ratingSummary = ref<ReviewListData['rating'] | null>(null);
  const reviewsLoading = ref(false);
  const isInitializing = ref(false);
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
    if (refresh) {
      isInitializing.value = true;
    }
    reviewsError.value = '';

    if (refresh) {
      reviewsPage.value = 1;
      reviews.value = [];
      reviewsHasMore.value = true;
      ratingSummary.value = null;
    }

    try {
      const response = await getReviewsByDish(dishId, {
        page: reviewsPage.value,
        pageSize: reviewsPageSize,
      });

      if (response.code === 200 && response.data) {
        ratingSummary.value = response.data.rating || ratingSummary.value;
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
      if (refresh) {
        isInitializing.value = false;
      }
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
    ratingSummary,
    reviewsLoading,
    isInitializing,
    reviewsError,
    reviewsHasMore,
    fetchReviews,
    submitReview,
    removeReview,
  };
}

/**
 * 评价表单相关逻辑
 */
export function useReviewForm() {
  const userStore = useUserStore();
  const reviewOwner = computed(() => userStore.isLoggedIn ? userStore.userInfo?.id : null);
  const reviewStateKey = (dishId: string) =>
    reviewOwner.value ? `review_state:${reviewOwner.value}:${dishId}` : null;
  const rating = ref(0);
  const content = ref('');
  const images = ref<ReviewImage[]>([]);
  const submitting = ref(false);
  const isSaving = ref(false);
  const isUploading = ref(false);
  const busy = computed(() => submitting.value || isSaving.value);
  const showFlavorError = ref(false);
  const uncommittedFiles = new Set<string>();
  let disposed = false;

  const captureOwner = () => {
    const owner = reviewOwner.value;
    const version = userStore.sessionVersion;
    return () => !disposed && !!owner && reviewOwner.value === owner && userStore.sessionVersion === version;
  };

  const releaseUncommittedFiles = () => {
    removeLocalImages(uncommittedFiles);
    uncommittedFiles.clear();
  };

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

  const flavorSelectionComplete = computed(
    () => !hasFlavorSelection.value || Object.values(flavorRatings.value).every(value => value > 0)
  );

  const ratingText = computed(() => {
    const texts = ['请选择评分', '非常差', '差', '一般', '好', '非常好'];
    return texts[rating.value] || texts[0];
  });

  const setRating = (star: number) => {
    if (busy.value) return;
    rating.value = star;
  };

  const setFlavorRating = (key: FlavorKey, value: number) => {
    if (busy.value) return;
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
    releaseUncommittedFiles();
    rating.value = 0;
    content.value = '';
    images.value = [];
    resetFlavorRatings();
  };

  // 当主评分清空时重置口味评分
  watch(rating, value => {
    if (value === 0) {
      resetFlavorRatings();
    }
  });

  /**
   * 保存评价状态到本地存储
   */
  const saveReviewState = async (dishId: string) => {
    const key = reviewStateKey(dishId);
    const isCurrent = captureOwner();
    if (!key || !isCurrent() || busy.value) return false;
    cleanupExpiredStates(key);
    const selectedImages = [...images.value];
    const state: ReviewState = {
      rating: rating.value,
      content: content.value,
      images: selectedImages.map(image => ({ ...image })),
      flavorRatings: { ...flavorRatings.value },
      timestamp: Date.now(),
    };
    isSaving.value = true;
    try {
      for (let index = 0; index < state.images.length; index++) {
        const image = state.images[index];
        if (image.source !== 'temporary') continue;
        const path = await saveLocalImage(image.path);
        if (!isCurrent()) {
          removeLocalImages([path]);
          return false;
        }
        uncommittedFiles.add(path);
        // saveFile 移动临时文件；后续保存失败时仍需保留可重试的路径。
        image.source = 'saved';
        image.path = path;
        Object.assign(selectedImages[index], image);
      }
      const previous = uni.getStorageSync(key) as ReviewState | undefined;
      uni.setStorageSync(key, state);
      const retained = new Set(savedImagePaths(state));
      retained.forEach(path => uncommittedFiles.delete(path));
      removeLocalImages(savedImagePaths(previous).filter(path => !retained.has(path)));
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      console.error('保存评价草稿失败:', error);
      uni.showToast({
        title: error === IMAGE_DRAFT_UNAVAILABLE ? IMAGE_DRAFT_UNAVAILABLE.message : '草稿保存失败，请重试',
        icon: 'none',
      });
      return false;
    } finally {
      if (isCurrent()) isSaving.value = false;
    }
  };

  const clearState = (key: string) => {
    const state = uni.getStorageSync(key) as ReviewState | undefined;
    uni.removeStorageSync(key);
    removeLocalImages(savedImagePaths(state));
  };

  const cleanupExpiredStates = (retainedKey?: string) => {
    if (!reviewOwner.value) return;
    const prefix = `review_state:${reviewOwner.value}:`;
    try {
      for (const key of uni.getStorageInfoSync().keys) {
        if (!key.startsWith(prefix) || key === retainedKey) continue;
        const state = uni.getStorageSync(key) as ReviewState | undefined;
        if (state && Date.now() - state.timestamp >= REVIEW_STATE_EXPIRY_MS) clearState(key);
      }
    } catch (error) {
      console.warn('清理过期评价草稿失败:', error);
    }
  };

  const readReviewState = (dishId: string): ReviewState | null => {
    const key = reviewStateKey(dishId);
    if (!key) return null;
    cleanupExpiredStates();
    try {
      const state = uni.getStorageSync(key) as ReviewState | undefined;
      if (state && typeof state === 'object') {
        if (Date.now() - state.timestamp < REVIEW_STATE_EXPIRY_MS) return state;
        clearState(key);
      }
    } catch (error) {
      console.log('读取评价状态失败:', error);
    }
    return null;
  };

  /**
   * 从本地存储恢复评价状态
   */
  const loadReviewState = (dishId: string) => {
    if (busy.value || disposed) return false;
    const state = readReviewState(dishId);
    if (!state) return false;
    resetForm();
    rating.value = state.rating || 0;
    content.value = state.content || '';
    images.value = (state.images || []).map(image => ({ ...image }));
    if (state.flavorRatings) flavorRatings.value = { ...state.flavorRatings };
    return true;
  };

  /**
   * 清除保存的评价状态
   */
  const clearReviewState = (dishId: string) => {
    const key = reviewStateKey(dishId);
    if (key) clearState(key);
  };

  /**
   * 检查是否有保存的评价状态
   */
  const hasSavedReviewState = (dishId: string) => !!readReviewState(dishId);

  const addImages = (tempFilePaths: string[]) => {
    if (busy.value || disposed) return;
    if (images.value.length + tempFilePaths.length > 3) {
      uni.showToast({ title: '最多只能选择3张图片', icon: 'none' });
      return;
    }
    images.value.push(...tempFilePaths.map(path => ({ source: 'temporary' as const, path })));
  };

  const setRemoteImages = (urls: string[]) => {
    images.value = urls.map(path => ({ source: 'remote', path }));
  };

  const removeImage = (index: number) => {
    if (busy.value) return;
    const [image] = images.value.splice(index, 1);
    if (image?.source === 'saved' && uncommittedFiles.delete(image.path)) {
      removeLocalImages([image.path]);
    }
  };

  /**
   * 提交评价
   */
  const handleSubmit = async (
    dishId: string,
    onSuccess?: () => void,
    _existingReviewId?: string
  ) => {
    const isCurrent = captureOwner();
    const key = reviewStateKey(dishId);
    if (busy.value || !isCurrent() || !key) return;

    try {
      if (rating.value === 0) {
        uni.showToast({
          title: '请先选择总体评分',
          icon: 'none',
        });
        return;
      }

      if (!flavorSelectionComplete.value) {
        showFlavorError.value = true;
        uni.showToast({
          title: '请选择全部口味评分或全部留空',
          icon: 'none',
        });
        return;
      }

      const selectedImages = images.value.map(image => ({ ...image }));
      const payload: ReviewCreateRequest = {
        dishId,
        rating: rating.value,
        content: content.value.trim(),
        images: [],
      };

      if (hasFlavorSelection.value) {
        payload.ratingDetails = { ...flavorRatings.value };
      }

      submitting.value = true;
      for (const image of selectedImages) {
        if (image.source === 'remote') {
          payload.images!.push(image.path);
        } else {
          isUploading.value = true;
          const result = await uploadImage(image.path);
          if (!isCurrent()) return;
          payload.images!.push(result.url);
        }
      }
      isUploading.value = false;

      // 后端 createReview 使用 userId + dishId upsert，编辑与新建共用同一原子接口。
      const response = await createReview(payload);
      if (!isCurrent()) return;

      if (response.code === 200 || response.code === 201) {
        clearState(key);
        resetForm();
        onSuccess?.();
      } else {
        uni.showToast({
          title: response.message || '提交失败',
          icon: 'none',
        });
      }
    } catch (err: any) {
      if (!isCurrent()) return;
      console.error('提交评价失败:', err);
      uni.showToast({
        title: isUploading.value ? '图片上传失败，请重试' : '网络错误，请稍后重试',
        icon: 'none',
      });
    } finally {
      if (isCurrent()) {
        submitting.value = false;
        isUploading.value = false;
      }
    }
  };

  watch([() => userStore.sessionVersion, reviewOwner], () => {
    resetForm();
    submitting.value = false;
    isSaving.value = false;
    isUploading.value = false;
  }, { flush: 'sync' });

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      releaseUncommittedFiles();
    });
  }

  return {
    rating,
    content,
    images,
    isSaving,
    busy,
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
    handleSubmit,
    addImages,
    setRemoteImages,
    removeImage,
  };
}
