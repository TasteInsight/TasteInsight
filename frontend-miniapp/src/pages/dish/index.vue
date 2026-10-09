<template>
  <view class="dish-page page-content">
    <!-- 错误状态 -->
    <view
      v-if="error"
      class="flex items-center justify-center py-6"
      :class="{ 'page-content': !dish }"
      role="alert"
    >
      <view class="text-center">
        <text class="text-black">{{ error }}</text>
        <button
          class="mt-4 px-4 py-2 bg-ts-purple text-white rounded-lg border border-ts-purple active:opacity-90 transition-colors"
          :disabled="loading"
          @click="refresh"
        >
          重试
        </button>
      </view>
    </view>

    <!-- 菜品详情内容 -->
    <view v-if="dish" class="dish-content" :aria-busy="loading">
      <view v-if="dishImages.length" class="dish-photos">
        <swiper
          class="dish-swiper"
          :indicator-dots="dishImages.length > 1"
          :circular="dishImages.length > 1"
          indicator-color="rgba(255,255,255,.65)"
          indicator-active-color="#660874"
        >
          <swiper-item v-for="image in dishImages" :key="image">
            <image
              :src="image"
              class="dish-photo"
              mode="aspectFill"
              @error="failedDishImages.push(image)"
            />
          </swiper-item>
        </swiper>
      </view>

      <view class="dish-summary">
        <view class="dish-title-row">
          <text class="dish-title">{{ dish.name }}</text>
          <text class="dish-price"
            >¥{{ dish.price
            }}<text v-if="dish.priceUnit" class="dish-price-unit">/{{ dish.priceUnit }}</text></text
          >
        </view>
        <view class="dish-location-row">
          <text class="dish-location">{{ dishLocation }}</text>
          <button
            v-if="dish.windowId"
            class="dish-window-link"
            data-testid="dish-window"
            @click="goToWindow"
          >
            查看窗口
          </button>
        </view>
        <view v-if="dish.tags?.length" class="dish-tags">
          <button v-for="tag in dish.tags" :key="tag" class="dish-tag" @click="goToTagDishes(tag)">
            <TagBadge :label="tag" />
          </button>
        </view>
        <view class="rating-overview" :class="{ 'rating-overview-empty': !displayReviewCount }">
          <view class="rating-total"
            ><text class="rating-average">{{
              displayAverageRating === 0 ? '暂无评分' : displayAverageRating.toFixed(1) + '分'
            }}</text
            ><text class="rating-count">{{ displayReviewCount }} 条评价</text></view
          >
          <RatingBars v-if="displayReviewCount > 0" ref="ratingBarsRef" :dish-id="dish.id" />
        </view>
      </view>

      <view class="dish-more">
        <button
          class="dish-more-toggle"
          :aria-expanded="isDetailExpanded"
          @click="toggleDetailExpansion"
        >
          <text>菜品信息</text><text>{{ isDetailExpanded ? '收起' : '展开' }}</text>
        </button>
        <view v-if="isDetailExpanded" class="dish-more-content">
          <view class="decision-facts">
            <view class="decision-row"
              ><text class="decision-label">供应餐时</text
              ><text class="decision-value">{{
                formatMealTime(dish.availableMealTime) || '暂未提供'
              }}</text></view
            >
            <view class="decision-taste"><TasteProfile :taste="dish" /></view>
            <view class="decision-row"
              ><text class="decision-label">已知过敏原</text
              ><text class="decision-value">{{
                dish.allergens?.length ? dish.allergens.join('、') : '暂未提供'
              }}</text></view
            >
          </view>
          <text class="dish-description">{{ dish.description || '菜品介绍暂未提供' }}</text>
          <text v-if="dish.ingredients?.length" class="dish-description"
            >主要食材：{{ dish.ingredients.join('、') }}</text
          >
          <button v-if="parentDish" class="dish-related" @click="goToParentDish">
            <text>所属菜品</text><text>{{ parentDish.name }}</text>
          </button>
          <view v-if="subDishes.length" class="dish-related-list">
            <text class="dish-related-heading">其他规格</text>
            <button
              v-for="sub in displayedSubDishes"
              :key="sub.id"
              class="dish-related"
              @click="goToSubDish(sub.id)"
            >
              <text>{{ sub.name }}</text
              ><text>¥{{ sub.price }}</text>
            </button>
            <button
              v-if="subDishes.length > 3"
              class="dish-more-toggle"
              @click="isSubDishesExpanded = !isSubDishesExpanded"
            >
              {{ isSubDishesExpanded ? '收起' : '展开全部规格（' + subDishes.length + '）' }}
            </button>
          </view>
        </view>
      </view>

      <view v-if="ownReviewLoading || ownReviewError || myReview" class="review-section">
        <view class="review-section-header">
          <text class="review-section-title">我的评价</text>
          <view v-if="myReview && ownReviewLoaded" class="review-own-actions">
            <button
              class="review-text-action"
              :disabled="deletingReview"
              @tap="handleDeleteMyReview"
            >
              {{ deletingReview ? '删除中…' : '删除' }}
            </button>
            <button class="review-text-action" :disabled="deletingReview" @tap="showReviewForm">
              修改
            </button>
          </view>
        </view>
        <view v-if="ownReviewError" class="review-state">
          <text>{{ ownReviewError }}</text
          ><button class="review-text-action" @tap="fetchOwnReview(dishId)">重试</button>
        </view>
        <view v-if="myReview" class="own-review">
          <view class="own-review-heading">
            <UserAvatar :src="myReview.userAvatar" :label="myReview.userNickname" />
            <text class="review-author">{{ myReview.userNickname }}</text>
          </view>
          <TasteProfile :taste="myReview.ratingDetails" collapsible class="review-rating">
            <template #summary>
              <view class="review-stars" :aria-label="'总体评分 ' + myReview.rating + ' 星'">
                <text
                  v-for="star in 5"
                  :key="star"
                  :class="{ 'is-filled': star <= myReview.rating }"
                  aria-hidden="true"
                  >{{ star <= myReview.rating ? '★' : '☆' }}</text
                >
              </view>
            </template>
          </TasteProfile>
          <text v-if="myReview.content" class="review-body-text">{{ myReview.content }}</text>
          <view v-if="ownReviewImages.length" class="own-review-images">
            <image
              v-for="(img, idx) in ownReviewImages"
              :key="img"
              :src="img"
              class="own-review-image"
              mode="aspectFill"
              @error="failedOwnReviewImages.push(img)"
              @tap.stop="previewMyReviewImage(ownReviewImages, idx)"
            />
          </view>
          <view class="own-review-meta">
            <text class="review-date">{{ formatReviewDate(myReview.createdAt) }}</text>
            <button
              v-if="myReview.status === 'approved' || reviewComments[myReview.id]?.total"
              class="review-text-action"
              @tap="showAllCommentsPanel(myReview.id)"
            >
              查看回复
            </button>
          </view>
          <text v-if="myReview.status === 'rejected'" class="review-status-hint"
            >这条评价未能发布，可以修改后重新提交。</text
          >
          <CommentList
            :review-id="myReview.id"
            :comments-data="reviewComments[myReview.id]"
            :fetch-comments="fetchComments"
            @comment-added="handleCommentAdded"
            @view-all-comments="showAllCommentsPanel(myReview.id)"
          />
        </view>
      </view>

      <view class="review-section">
        <view class="review-section-header"
          ><text class="review-section-title">用户评价</text></view
        >

        <ReviewList
          :dish-id="dishId"
          :reviews="otherReviews"
          :loading="reviewsLoading"
          :initialized="reviewsInitialized"
          :error="reviewsError"
          :has-more="reviewsHasMore"
          :review-comments="reviewComments"
          :fetch-comments="fetchComments"
          @load-more="loadMoreReviews"
          @retry="retryReviews"
          @view-all-comments="showAllCommentsPanel"
          @report="id => openReportModal('review', id)"
          @delete="handleDeleteReview"
        />
      </view>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <!-- 微信小程序：使用 page-container 拦截返回，确保返回时关闭弹窗而不是返回上一页 -->
    <page-container
      v-if="shouldRenderReviewHelper"
      :key="reviewHelperKey"
      :show="isReviewFormVisible"
      :overlay="false"
      :duration="300"
      custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="requestReviewFormClose"
      @afterleave="restoreReviewHelper"
    />
    <!-- #endif -->

    <!-- 评价表单弹窗 -->
    <ReviewForm
      v-if="isReviewFormVisible"
      ref="reviewFormRef"
      :dish-id="dishId"
      :dish-name="dish?.name || ''"
      :existing-review-id="reviewFormInitial?.id"
      :initial-review="reviewFormInitial"
      @close="hideReviewForm"
      @success="handleReviewSuccess"
    />

    <!-- 全部评论面板 -->
    <AllCommentsPanel
      v-if="shouldRenderAllCommentsPanel"
      ref="commentsPanelRef"
      :review-id="currentCommentsReviewId"
      :is-visible="isAllCommentsPanelVisible"
      @close="hideAllCommentsPanel"
      @comment-added="handleCommentAdded"
    />

    <!-- 举报弹窗 -->
    <ReportDialog
      v-if="isReportVisible"
      ref="reportDialogRef"
      :submitting="reportSubmitting"
      @close="closeReportModal"
      @submit="submitReport"
    />

    <!-- #ifdef MP-WEIXIN -->
    <page-container
      v-if="renderQuickPlanHelper"
      :show="isQuickPlanVisible"
      :overlay="false"
      :duration="0"
      custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="requestQuickPlanClose"
      @afterleave="restoreQuickPlanHelper"
    />
    <!-- #endif -->
    <PlanEditDialog
      v-if="isQuickPlanVisible"
      ref="quickPlanRef"
      :visible="isQuickPlanVisible"
      :plan="null"
      :initial-dishes="planInitialDishes"
      :submitting="planSubmitting"
      @close="closeQuickPlan"
      @submit="saveQuickPlan"
    />

    <!-- 底部操作栏 -->
    <BottomReviewInput
      v-if="dish && !isAllCommentsPanelVisible && !isReviewFormVisible && !isQuickPlanVisible"
      :is-favorited="isFavorited"
      :favorite-loading="favoriteLoading"
      :has-review="!!myReview"
      :review-loading="ownReviewLoading"
      :review-disabled="!ownReviewLoaded || !!ownReviewError || deletingReview"
      @review="showQuickReviewForm"
      @favorite="toggleFavorite"
      @plan="openQuickPlan"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onScopeDispose } from 'vue';
import { onLoad, onBackPress, onPullDownRefresh, onReachBottom, onHide } from '@dcloudio/uni-app';
import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';
import { useUserStore } from '@/store/modules/use-user-store';
import { usePlanStore } from '@/store/modules/use-plan-store';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';
import type { Dish, MealPlanRequest, Review } from '@/types/api';
import dayjs from 'dayjs';
import ReviewList from './components/ReviewList.vue';
import ReviewForm from './components/ReviewForm.vue';
import BottomReviewInput from './components/BottomReviewInput.vue';
import AllCommentsPanel from './components/AllCommentsPanel.vue';
import CommentList from './components/CommentList.vue';
import RatingBars from './components/RatingBars.vue';
import TasteProfile from './components/TasteProfile.vue';
import TagBadge from '@/components/TagBadge.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import ReportDialog from './components/ReportDialog.vue';
import { useReport } from '@/pages/dish/composables/use-report';

const dishId = ref('');
const {
  dish,
  loading,
  error,
  fetchDishDetail,
  subDishes,
  parentDish,
  reviews,
  ownReview: myReview,
  ownReviewLoading,
  ownReviewLoaded,
  ownReviewError,
  fetchOwnReview,
  invalidateOwnReview,
  deletingReview,
  ratingSummary,
  reviewsLoading,
  reviewsInitialized,
  reviewsError,
  reviewsHasMore,
  retryReviews,
  loadMoreReviews,
  reviewComments,
  fetchComments,
  removeReview,
  isFavorited,
  favoriteLoading,
  toggleFavorite,
} = useDishDetail();

const {
  isReportVisible,
  submitting: reportSubmitting,
  openReportModal,
  closeReportModal,
  submitReport,
} = useReport();

const userStore = useUserStore();
const planStore = usePlanStore();

const failedOwnReviewImages = ref<string[]>([]);
const ownReviewImages = computed(() =>
  (myReview.value?.images || []).filter(image => !failedOwnReviewImages.value.includes(image))
);

const displayAverageRating = computed(() => {
  const avg = ratingSummary.value?.average;
  return typeof avg === 'number' ? avg : dish.value?.averageRating || 0;
});

const displayReviewCount = computed(() => {
  const total = ratingSummary.value?.total;
  return typeof total === 'number' ? total : dish.value?.reviewCount || 0;
});

const otherReviews = computed(() => {
  const uid = userStore.userInfo?.id;
  if (!uid) return reviews.value;
  return (reviews.value || []).filter(r => r.userId !== uid);
});

const failedDishImages = ref<string[]>([]);
const dishImages = computed(() =>
  (dish.value?.images || []).filter(image => !failedDishImages.value.includes(image))
);
const dishLocation = computed(() => {
  const item = dish.value;
  return (
    [
      item?.canteenName,
      item?.floorName || (item?.floorLevel ? item.floorLevel + '楼' : ''),
      item?.windowName || item?.windowNumber,
    ]
      .filter(Boolean)
      .join(' / ') || '位置信息暂未提供'
  );
});
const goToWindow = () => {
  if (dish.value?.windowId)
    uni.navigateTo({ url: '/pages/window/index?id=' + encodeURIComponent(dish.value.windowId) });
};

const isReviewFormVisible = ref(false);
const reviewFormInitial = ref<Review | null>(null);
const reviewFormRef = ref<InstanceType<typeof ReviewForm> | null>(null);
const commentsPanelRef = ref<InstanceType<typeof AllCommentsPanel> | null>(null);
const reportDialogRef = ref<InstanceType<typeof ReportDialog> | null>(null);
const quickPlanRef = ref<InstanceType<typeof PlanEditDialog> | null>(null);
const renderQuickPlanHelper = ref(true);
const isDetailExpanded = ref(false);
const isAllCommentsPanelVisible = ref(false);
const currentCommentsReviewId = ref('');
const isSubDishesExpanded = ref(false);
const ratingBarsRef = ref();

// 控制 page-container 的渲染，延迟销毁以避免滚动锁定问题
const shouldRenderAllCommentsPanel = ref(false);
const shouldRenderReviewHelper = ref(false);
const reviewHelperKey = ref(0);
let active = true;
onScopeDispose(() => {
  active = false;
});

const isQuickPlanVisible = ref(false);
const planSubmitting = ref(false);
const planInitialDishes = ref<Dish[]>([]);
let planDialogVersion = 0;

const closeQuickPlan = () => {
  planDialogVersion += 1;
  isQuickPlanVisible.value = false;
  planSubmitting.value = false;
};
const requestQuickPlanClose = () => quickPlanRef.value?.requestClose();
const restoreQuickPlanHelper = async () => {
  if (!active || !isQuickPlanVisible.value) return;
  renderQuickPlanHelper.value = false;
  await nextTick();
  if (active && isQuickPlanVisible.value) renderQuickPlanHelper.value = true;
};
const openQuickPlan = () => {
  if (!dish.value || loading.value || dish.value.id !== dishId.value) return;
  planDialogVersion += 1;
  renderQuickPlanHelper.value = true;
  planInitialDishes.value = [dish.value];
  isQuickPlanVisible.value = true;
};
const saveQuickPlan = async (payload: MealPlanRequest): Promise<boolean> => {
  if (planSubmitting.value || !isQuickPlanVisible.value) return false;
  const version = planDialogVersion;
  const session = userStore.sessionVersion;
  const sourceDish = dishId.value;
  const isCurrent = () =>
    active &&
    isQuickPlanVisible.value &&
    version === planDialogVersion &&
    session === userStore.sessionVersion &&
    sourceDish === dishId.value;
  planSubmitting.value = true;
  try {
    await planStore.createPlan(payload);
    if (!isCurrent()) return false;
    closeQuickPlan();
    uni.showToast({ title: '已加入规划', icon: 'success' });
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    uni.showToast({
      title: error instanceof Error ? error.message : '保存失败，请重试',
      icon: 'none',
    });
    return false;
  } finally {
    if (isCurrent()) planSubmitting.value = false;
  }
};
watch(
  [dishId, () => dish.value?.id, () => userStore.sessionVersion],
  () => {
    closeQuickPlan();
    failedDishImages.value = [];
  },
  { flush: 'sync' }
);
onScopeDispose(closeQuickPlan);
onHide(() => {
  if (planSubmitting.value) closeQuickPlan();
});

watch(
  () => userStore.sessionVersion,
  () => {
    hideReviewForm();
    isAllCommentsPanelVisible.value = false;
    closeReportModal();
  },
  { flush: 'sync' }
);

watch(isAllCommentsPanelVisible, (val: boolean) => {
  if (val) {
    shouldRenderAllCommentsPanel.value = true;
  } else {
    setTimeout(() => {
      if (!isAllCommentsPanelVisible.value) shouldRenderAllCommentsPanel.value = false;
    }, 300);
  }
});

watch(isReviewFormVisible, (val: boolean) => {
  if (val) {
    shouldRenderReviewHelper.value = true;
  } else {
    setTimeout(() => {
      if (!isReviewFormVisible.value) shouldRenderReviewHelper.value = false;
    }, 300);
  }
});

// 监听我的评价变化，加载评论数据
watch(
  () => myReview.value,
  async (newMyReview, oldMyReview) => {
    const nextId = newMyReview?.id;
    const prevId = oldMyReview?.id;
    if (!nextId) return;

    // 我的评价从无到有，或评价记录被替换（id 变化）时，重新加载评论预览
    if (!prevId || nextId !== prevId) {
      try {
        await fetchComments(nextId);
      } catch (err) {
        console.error('加载我的评价评论失败:', err);
      }
    }
  },
  { immediate: true }
);

// 拦截返回键，如果有弹窗打开则关闭弹窗而不是返回上一页
onBackPress(() => {
  if (isQuickPlanVisible.value) {
    void requestQuickPlanClose();
    return true;
  }
  if (isReviewFormVisible.value) {
    void requestReviewFormClose();
    return true;
  }
  if (isAllCommentsPanelVisible.value) {
    void commentsPanelRef.value?.requestClose();
    return true;
  }
  if (isReportVisible.value) {
    void reportDialogRef.value?.requestClose();
    return true;
  }
  return false;
});

// 计算显示的子菜品（默认前3个，展开后全部）
const displayedSubDishes = computed(() => {
  if (isSubDishesExpanded.value) {
    return subDishes.value;
  }
  return subDishes.value.slice(0, 3);
});

onLoad((options: any) => {
  if (options.id) {
    dishId.value = options.id;
    fetchDishDetail(options.id);
  }
});

// 下拉刷新处理
onPullDownRefresh(async () => {
  try {
    if (dishId.value) {
      if (!(await fetchDishDetail(dishId.value))) return;
    }
    uni.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1500,
    });
  } catch (err) {
    console.error('下拉刷新失败:', err);
    uni.showToast({
      title: '刷新失败',
      icon: 'none',
    });
  } finally {
    uni.stopPullDownRefresh();
  }
});

// 触底上拉：加载更多评价
onReachBottom(async () => {
  if (isQuickPlanVisible.value) return;
  if (isAllCommentsPanelVisible.value) return;
  if (isReviewFormVisible.value) return;
  if (reviewsLoading.value || reviewsError.value) return;
  if (!reviewsHasMore.value) return;
  await loadMoreReviews();
});

// 跳转到子菜品详情
const goToSubDish = (id: string) => {
  if (!id) return;
  uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
};

// 跳转到父菜品详情
const goToParentDish = () => {
  if (!parentDish.value?.id) return;
  uni.navigateTo({ url: `/pages/dish/index?id=${parentDish.value.id}` });
};

// 跳转到标签菜品列表
const goToTagDishes = (tag: string) => {
  if (!tag || !dish.value?.canteenId) return;
  uni.navigateTo({
    url: `/pages/dish/components/TagList?tag=${encodeURIComponent(tag)}&canteenId=${dish.value.canteenId}&canteenName=${encodeURIComponent(dish.value.canteenName || '')}`,
  });
};

const goBack = () => {
  if (isQuickPlanVisible.value) {
    void requestQuickPlanClose();
    return;
  }
  if (isReviewFormVisible.value) {
    void requestReviewFormClose();
    return;
  }
  uni.navigateBack();
};

const refresh = () => {
  if (dishId.value) {
    fetchDishDetail(dishId.value);
  }
};

const formatMealTime = (mealTimes: string[] | undefined) => {
  if (!mealTimes) return '';
  const timeMap: Record<string, string> = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    nightsnack: '夜宵',
  };
  return mealTimes.map(time => timeMap[time] || time).join('、');
};

const showReviewForm = () => {
  if (
    !ownReviewLoaded.value ||
    ownReviewLoading.value ||
    ownReviewError.value ||
    deletingReview.value
  )
    return;
  reviewFormInitial.value = myReview.value
    ? {
        ...myReview.value,
        images: [...(myReview.value.images || [])],
        ratingDetails: myReview.value.ratingDetails ? { ...myReview.value.ratingDetails } : null,
      }
    : null;
  isReviewFormVisible.value = true;
};

const hideReviewForm = () => {
  isReviewFormVisible.value = false;
};

const requestReviewFormClose = () => reviewFormRef.value?.requestClose();

const restoreReviewHelper = () => {
  // 原生返回会关闭拦截容器；保存尚未完成时重新建立返回拦截。
  if (active && isReviewFormVisible.value) reviewHelperKey.value++;
};

const handleReviewSuccess = async (submittedReview?: Review) => {
  const sessionVersion = userStore.sessionVersion;
  const owner = userStore.userInfo?.id;
  const reviewedDishId = dishId.value;
  const isCurrent = () =>
    active &&
    userStore.sessionVersion === sessionVersion &&
    userStore.userInfo?.id === owner &&
    dishId.value === reviewedDishId;
  if (!isCurrent()) return;
  invalidateOwnReview();
  if (submittedReview) {
    myReview.value = submittedReview;
  }
  hideReviewForm();

  // 刷新评价列表和菜品信息
  if (reviewedDishId) {
    await fetchDishDetail(reviewedDishId, isCurrent);
  }
  if (!isCurrent()) return;

  // 刷新评分条状图
  ratingBarsRef.value?.refresh();
};

const formatReviewDate = (dateString: string) => {
  return dayjs(dateString).format('YYYY-MM-DD HH:mm');
};

const previewMyReviewImage = (urls: string[], current: number) => {
  uni.previewImage({
    urls,
    current: urls[current],
  });
};

const handleDeleteMyReview = () => {
  if (!myReview.value || deletingReview.value) return;
  const reviewId = myReview.value.id;
  const session = userStore.sessionVersion;
  uni.showModal({
    title: '提示',
    content: '确定要删除你的这条评价吗？',
    success: async res => {
      if (
        !res.confirm ||
        !active ||
        session !== userStore.sessionVersion ||
        reviewId !== myReview.value?.id
      )
        return;
      try {
        await removeReview(reviewId, () => {
          // 刷新评分条状图
          ratingBarsRef.value?.refresh();
        });
        // removeReview 已经处理了刷新逻辑，这里不需要重复
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    },
  });
};

const toggleDetailExpansion = () => {
  isDetailExpanded.value = !isDetailExpanded.value;
};

const showQuickReviewForm = () => {
  showReviewForm();
};

const showAllCommentsPanel = (reviewId: string) => {
  currentCommentsReviewId.value = reviewId;
  isAllCommentsPanelVisible.value = true;
};

const hideAllCommentsPanel = async () => {
  isAllCommentsPanelVisible.value = false;
  currentCommentsReviewId.value = '';
};

const handleCommentAdded = async () => {
  const reviewId = currentCommentsReviewId.value;

  // 刷新该条评价的评论预览（列表页展示用）
  if (reviewId) {
    await fetchComments(reviewId);
  }
};

const handleDeleteReview = async (reviewId: string) => {
  await removeReview(reviewId, () => {
    // 刷新评分条状图
    ratingBarsRef.value?.refresh();
  });
};
</script>

<style scoped>
.dish-page {
  background: #fff;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.dish-content {
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}
.dish-swiper {
  width: 100%;
  height: 232px;
}
.dish-photo {
  width: 100%;
  height: 100%;
}
.dish-summary {
  padding: 20px 20px 16px;
  background: #fff;
}
.dish-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.dish-title {
  flex: 1;
  min-width: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.dish-price {
  color: var(--color-price, #2f6b50);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.45;
  white-space: nowrap;
}
.dish-price-unit {
  font-size: 12px;
  font-weight: 400;
  color: #667085;
}
.dish-location-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}
.dish-location {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #667085;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.dish-page button::after {
  border: 0;
}
.dish-page button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.dish-page button:active {
  opacity: 0.72;
}
.dish-window-link {
  margin: 0;
  padding: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  color: #660874;
  background: #fff;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
}
.dish-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 2px;
}
.dish-tag {
  display: flex;
  align-items: center;
  max-width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0;
  background: #fff;
  color: #660874;
  font-size: 13px;
  line-height: 1.4;
}
.dish-tag:active {
  opacity: 0.7;
}
.decision-facts {
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}
.decision-row {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
  line-height: 1.6;
  font-size: 14px;
}
.decision-label {
  width: 74px;
  flex-shrink: 0;
  color: #667085;
}
.decision-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.decision-taste {
  margin: 16px 0;
}
.dish-more {
  margin-top: 8px;
  padding: 0 20px;
  background: #fff;
}
.dish-more-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  margin: 0;
  padding: 14px 0;
  background: #fff;
  min-height: 48px;
  font-size: 15px;
  line-height: 1.4;
  color: #1f2937;
  text-align: left;
}
.dish-more-toggle text:last-child {
  color: #667085;
  font-size: 13px;
}
.dish-more-content {
  padding-bottom: 16px;
}
.dish-description {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.7;
}
.dish-related-heading {
  display: block;
  color: #667085;
  font-size: 13px;
}
.dish-related {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 10px 0;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  color: #660874;
  text-align: left;
  font-size: 14px;
  line-height: 1.5;
}
.rating-overview {
  display: flex;
  align-items: center;
  gap: 20px;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 18px;
  border-top: 1px solid #e5e7eb;
}
.rating-overview-empty .rating-total {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.rating-overview-empty .rating-average {
  font-size: 16px;
  color: #667085;
}
.rating-total {
  flex-shrink: 0;
}
.rating-average {
  display: block;
  font-size: 22px;
  font-weight: 600;
  color: var(--color-rating, #946200);
}
.rating-count {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #667085;
}
.review-section {
  padding: 20px;
  border-top: 1px solid #e5e7eb;
}
.review-section-header,
.review-own-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.review-section-header {
  margin-bottom: 12px;
}
.review-section-title {
  font-size: 18px;
  font-weight: 600;
}
.review-text-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 0 8px;
  color: #660874;
  background: #fff;
  font-size: 14px;
  line-height: 1.5;
}
.review-state {
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}
.own-review-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}
.review-author {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.65;
}
.review-stars {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
  color: #98a2b3;
  font-size: 16px;
  line-height: 1;
}
.review-stars .is-filled {
  color: #d99a12;
}
.review-rating {
  margin-top: 4px;
}
.review-body-text {
  display: block;
  margin-top: 12px;
  font-size: 16px;
  line-height: 1.65;
  white-space: pre-wrap;
}
.own-review-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.own-review-image {
  width: 76px;
  height: 76px;
  border-radius: 10px;
}
.own-review-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.review-date {
  color: #667085;
  font-size: 14px;
  line-height: 1.5;
}
.review-status-hint {
  display: block;
  margin-top: 8px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}
</style>
