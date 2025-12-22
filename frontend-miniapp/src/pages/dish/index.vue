<template>
  <view class="min-h-screen bg-white">
    <!-- 骨架屏 -->
    <DishDetailSkeleton v-if="loading && !dish" />

    <!-- 错误状态 -->
    <view v-else-if="error" class="flex items-center justify-center min-h-screen">
      <view class="text-center">
        <text class="text-black">{{ error }}</text>
        <button 
          class="mt-4 px-4 py-2 bg-ts-purple text-white rounded-lg border border-ts-purple active:opacity-90 transition-colors"
          @click="refresh"
        >
          重试
        </button>
      </view>
    </view>

    <!-- 菜品详情内容 -->
    <view v-else-if="dish" class="pb-16">
      <!-- 图片轮播 -->
      <view class="relative" v-if="dish.images && dish.images.length > 0">
        <swiper
          class="dish-swiper"
          :indicator-dots="dish.images.length > 1"
          :autoplay="true"
          :interval="3000"
          :circular="true"
          indicator-color="rgba(255, 255, 255, 0.5)"
          indicator-active-color="#8B5CF6"
        >
          <swiper-item v-for="(image, index) in dish.images" :key="index" class="relative overflow-hidden">
            <!-- 背景模糊层 -->
            <image
              :src="image"
              class="absolute inset-0 w-full h-full blur-bg"
              mode="aspectFill"
            />
            <!-- 渐变遮罩层 - 优化边缘过渡 -->
            <view class="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10 backdrop-blur-sm z-1"></view>

            <!-- 强力边缘融合层：使用多重box-shadow模拟羽化效果 -->
            <view class="absolute inset-0 z-5 pointer-events-none"
                  style="box-shadow: inset 0 0 60px 40px rgba(255,255,255,0.5);">
            </view>

            <!-- 模糊遮罩层：进一步柔化边界 -->
            <view class="absolute inset-0 z-6 pointer-events-none bg-gradient-to-r from-white/30 via-transparent to-white/30 backdrop-blur-md"></view>

            <!-- 主体图片容器 -->
            <view class="relative w-full h-full flex items-center justify-center z-10">
              <image
                :src="image"
                class="w-full h-full"
                mode="aspectFit"
                style="-webkit-mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%); mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);"
              />
            </view>
            
            <!-- 边缘融合遮罩 -->
            <view class="absolute inset-0 z-20 pointer-events-none" 
                  style="background: radial-gradient(circle, transparent 50%, rgba(255,255,255,0.4) 100%);">
            </view>
          </swiper-item>
        </swiper>
      </view>

      <!-- 基本信息 -->
      <view class="bg-white p-4">
        <view class="flex justify-between items-start mb-2">
          <view class="flex-1">
            <h1 class="text-xl font-bold text-gray-800">{{ dish.name }}</h1>
            <view class="text-sm text-gray-500 mt-1 flex items-center">
              <text class="iconfont icon-store"></text>
              <text class="ml-1">{{ dish.canteenName }} · {{ dish.windowName }}</text>
            </view>
          </view>
          <view class="text-right mt-2">
            <view class="text-lg font-bold text-orange-500">¥{{ dish.price }}{{ dish.priceUnit ? `/${dish.priceUnit}` : '' }}</view>
          </view>
        </view>

        <!-- 标签 -->
        <view v-if="dish.tags?.length" class="flex flex-wrap gap-2">
          <span
            v-for="tag in dish.tags"
            :key="tag"
            class="px-3 py-1 bg-blue-50 text-blue-600 text-xs rounded-md cursor-pointer active:bg-blue-100"
            @click="goToTagDishes(tag)"
          >
            #{{ tag }}
          </span>
        </view>

        <!-- 评分信息 -->
        <view class="mt-3 py-3 border-t border-gray-100">
          <view class="flex justify-between items-start">
            <!-- 左侧评分和评价数量 -->
            <view class="flex flex-col mt-8 ml-6">
              <view class="text-xl font-bold text-yellow-500">
                {{ dish.averageRating === 0 ? '暂无' : `${dish.averageRating.toFixed(1)}分` }}
              </view>
              <view class="text-xs text-gray-500 mt-1">
                {{ dish.reviewCount }} 条评价
              </view>
            </view>

            <!-- 右侧评分比例条状图 -->
            <RatingBars :dish-id="dish.id" />
          </view>
        </view>
      </view>
      
      <!-- 分隔线 -->
      <view class="h-3 bg-gray-50 border-t border-b border-gray-100"></view>

      <!-- 我的评价：置顶展示（位于详细信息与用户评价之间） -->
      <view class="bg-white p-4">
        <view class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-gray-800">我的评价</h2>
          <view class="flex items-center gap-3">
            <view
              v-if="myReview"
              class="text-sm text-gray-500"
              @tap="handleDeleteMyReview"
            >删除</view>
            <view
              class="text-sm text-ts-purple"
              @tap="showReviewForm"
            >{{ myReview ? '修改' : '去评价' }}</view>
          </view>
        </view>

        <view v-if="myReview" class="border border-gray-100 rounded-lg p-3">
          <view class="flex items-start">
            <image
              :src="myReview.userAvatar || '/default-avatar.png'"
              class="w-10 h-10 rounded-full mr-3 flex-shrink-0"
              mode="aspectFill"
            />

            <view class="flex-1">
              <view class="font-bold text-purple-900 text-sm">{{ myReview.userNickname }}</view>
              <view class="flex items-center mt-1">
                <text
                  v-for="star in 5"
                  :key="star"
                  class="text-base mr-0.5"
                  :class="star <= myReview.rating ? 'text-yellow-500' : 'text-gray-300'"
                >{{ star <= myReview.rating ? '★' : '☆' }}</text>
              </view>

              <view v-if="myReview.ratingDetails" class="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
                <view class="px-2 py-1 bg-gray-50 rounded">辣度 {{ myReview.ratingDetails.spicyLevel }}/5</view>
                <view class="px-2 py-1 bg-gray-50 rounded">甜度 {{ myReview.ratingDetails.sweetness }}/5</view>
                <view class="px-2 py-1 bg-gray-50 rounded">咸度 {{ myReview.ratingDetails.saltiness }}/5</view>
                <view class="px-2 py-1 bg-gray-50 rounded">油腻 {{ myReview.ratingDetails.oiliness }}/5</view>
              </view>

              <view class="text-sm text-gray-700 leading-relaxed mt-2">{{ myReview.content }}</view>

              <view v-if="myReview.images && myReview.images.length > 0" class="flex flex-wrap gap-2 mt-2">
                <image
                  v-for="(img, idx) in myReview.images"
                  :key="idx"
                  :src="img"
                  class="w-20 h-20 rounded object-cover border border-gray-100"
                  mode="aspectFill"
                  @tap.stop="previewMyReviewImage(myReview.images, idx)"
                />
              </view>

              <view class="text-xs text-gray-400 mt-2">{{ formatReviewDate(myReview.createdAt) }}</view>
            </view>
          </view>
        </view>

        <view v-else class="text-sm text-gray-400 py-2">你还没有评价过这道菜</view>
      </view>

      <!-- 分隔线 -->
      <view class="h-3 bg-gray-50 border-t border-b border-gray-100"></view>

      <!-- 详细信息 -->
      <view class="bg-white p-4">
        <!-- 标题 - 始终显示 -->
        <view class="flex justify-between items-center mb-3">
          <h2 class="text-lg font-semibold text-gray-800">详细信息</h2>
          <text 
            v-if="!isDetailExpanded"
            class="text-sm text-gray-500 cursor-pointer"
            @click="toggleDetailExpansion"
          >展开 ↓</text>
        </view>

        <!-- 供应时间 - 始终显示 -->
        <view class="detail-section mb-3">
          <text class="font-bold text-black mr-1 text-sm">供应时间：</text>
          <text class="detail-text">{{ formatMealTime(dish.availableMealTime) }}</text>
        </view>

        <view v-show="isDetailExpanded" class="transition-all duration-300 ease-in-out">
          <!-- 菜品介绍 -->
          <view v-if="dish.description" class="detail-section">
            <text class="font-bold text-black mr-1 text-sm">菜品介绍：</text>
            <text class="detail-text">{{ dish.description }}</text>
          </view>

          <!-- 主要食材 -->
          <view v-if="dish.ingredients?.length" class="detail-section">
            <text class="font-bold text-black mr-1 text-sm">主要食材：</text>
            <text class="detail-text">{{ dish.ingredients.join('、') }}</text>
          </view>

          <!-- 过敏原信息 -->
          <view v-if="dish.allergens?.length" class="detail-section">
            <text class="font-bold text-black mr-1 text-sm">过敏原信息：</text>
            <text class="detail-text text-red-600">{{ dish.allergens.join('、') }}</text>
          </view>

          <!-- 父菜品（如果有） -->
          <view v-if="parentDish" class="detail-section mt-3">
            <text class="font-bold text-black mr-1 text-sm">所属菜品：</text>
            <view 
              class="mt-2 bg-gray-50 p-3 rounded-lg flex items-center gap-3 cursor-pointer"
              @click="goToParentDish"
            >
              <image v-if="parentDish.images?.[0]" :src="parentDish.images[0]" class="w-14 h-14 rounded-md object-cover" mode="aspectFill" />
              <view v-else class="w-14 h-14 bg-gray-200 rounded-md flex items-center justify-center">
                <text class="iconfont icon-food text-gray-400"></text>
              </view>
              <view class="flex-1 min-w-0">
                <view class="font-medium text-sm text-gray-800 truncate">{{ parentDish.name }}</view>
                <view class="text-xs text-red-600 mt-1">¥{{ parentDish.price }}</view>
              </view>
              <text class="iconfont icon-chevronright text-gray-400"></text>
            </view>
          </view>

          <!-- 子菜品（如果有） -->
          <view v-if="subDishes.length > 0" class="detail-section mt-3">
            <text class="font-bold text-black mr-1 text-sm">子菜品：</text>
            <view class="mt-2 space-y-3">
              <view
                v-for="sub in displayedSubDishes"
                :key="sub.id"
                class="bg-gray-50 p-3 rounded-lg flex items-center gap-3 cursor-pointer"
                @click="goToSubDish(sub.id)"
              >
                <image v-if="sub.images?.[0]" :src="sub.images[0]" class="w-14 h-14 rounded-md object-cover" mode="aspectFill" />
                <view v-else class="w-14 h-14 bg-gray-200 rounded-md flex items-center justify-center">
                  <text class="iconfont icon-food text-gray-400"></text>
                </view>
                <view class="flex-1 min-w-0">
                  <view class="font-medium text-sm text-gray-800 truncate">{{ sub.name }}</view>
                  <view class="text-xs text-red-600 mt-1">¥{{ sub.price }}</view>
                </view>
                <text class="iconfont icon-chevronright text-gray-400"></text>
              </view>
            </view>
            <!-- 展开/收起子菜品按钮 -->
            <view
              v-if="subDishes.length > 3"
              class="mt-3 text-center"
            >
              <view
                class="inline-block text-sm text-gray-500 py-1 cursor-pointer"
                @click.stop="isSubDishesExpanded = !isSubDishesExpanded"
              >
                {{ isSubDishesExpanded ? '收起' : `展开全部 (${subDishes.length}个)` }}
                <text class="ml-1 text-xs">{{ isSubDishesExpanded ? '↑' : '↓' }}</text>
              </view>
            </view>
          </view>

          <!-- 收起详细信息按钮 - 在最下面 -->
          <view class="mt-4 pt-3 border-t border-gray-100 text-center">
            <text 
              class="text-sm text-gray-500 cursor-pointer"
              @click="toggleDetailExpansion"
            >收起详细信息 ↑</text>
          </view>
        </view>
      </view>

      <!-- 分隔线 -->
      <view class="h-3 bg-gray-50 border-t border-b border-gray-100"></view>

      <!-- 评价列表 -->
      <view class="bg-white p-4">
        <view class="mb-4">
          <h2 class="text-lg font-semibold text-gray-800">用户评价</h2>
        </view>

        <ReviewList
          :dish-id="dishId"
          :reviews="otherReviews"
          :loading="reviewsLoading"
          :error="reviewsError"
          :has-more="reviewsHasMore"
          :review-comments="reviewComments"
          :fetch-comments="fetchComments"
          @load-more="loadMoreReviews"
          @view-all-comments="showAllCommentsPanel"
          @report="(id) => openReportModal('review', id)"
          @delete="removeReview"
        />
      </view>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <!-- 微信小程序：使用 page-container 拦截返回，确保返回时关闭弹窗而不是返回上一页 -->
    <page-container
      v-if="shouldRenderReviewHelper"
      :show="isReviewFormVisible"
      :overlay="false"
      :duration="300"
      custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="hideReviewForm"
    />
    <!-- #endif -->

    <!-- 评价表单弹窗 -->
    <ReviewForm
      v-if="isReviewFormVisible"
      :dish-id="dishId"
      :dish-name="dish?.name || ''"
      :existing-review-id="myReview?.id"
      :initial-review="myReview"
      @close="hideReviewForm"
      @success="handleReviewSuccess"
    />

    <!-- 全部评论面板 -->
    <AllCommentsPanel
      v-if="shouldRenderAllCommentsPanel"
      :review-id="currentCommentsReviewId"
      :is-visible="isAllCommentsPanelVisible"
      @close="hideAllCommentsPanel"
      @comment-added="handleCommentAdded"
      @delete="(id) => removeComment(id, currentCommentsReviewId)"
    />

    <!-- 举报弹窗 -->
    <ReportDialog
      v-if="isReportVisible"
      @close="closeReportModal"
      @submit="submitReport"
    />

    <!-- 底部操作栏 -->
    <BottomReviewInput
      v-if="dish && !isAllCommentsPanelVisible"
      :is-favorited="isFavorited"
      :favorite-loading="favoriteLoading"
      @review="showQuickReviewForm"
      @favorite="toggleFavorite"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { onLoad, onBackPress, onPullDownRefresh } from '@dcloudio/uni-app';
import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';
import { useUserStore } from '@/store/modules/use-user-store';
import dayjs from 'dayjs';
import ReviewList from './components/ReviewList.vue';
import ReviewForm from './components/ReviewForm.vue';
import BottomReviewInput from './components/BottomReviewInput.vue';
import AllCommentsPanel from './components/AllCommentsPanel.vue';
import RatingBars from './components/RatingBars.vue';
import ReportDialog from './components/ReportDialog.vue';
import { DishDetailSkeleton } from '@/components/skeleton';
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
} = useDishDetail();

const {
  isReportVisible,
  openReportModal,
  closeReportModal,
  submitReport
} = useReport();

const userStore = useUserStore();

const myReview = computed(() => {
  const uid = userStore.userInfo?.id;
  if (!uid) return null;
  const mine = (reviews.value || []).filter(r => r.userId === uid);
  if (mine.length === 0) return null;
  return mine
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
});

const otherReviews = computed(() => {
  const uid = userStore.userInfo?.id;
  if (!uid) return reviews.value;
  return (reviews.value || []).filter(r => r.userId !== uid);
});

const isReviewFormVisible = ref(false);
const isDetailExpanded = ref(false);
const isAllCommentsPanelVisible = ref(false);
const currentCommentsReviewId = ref('');
const isSubDishesExpanded = ref(false);
const shouldRefreshDishDetail = ref(false);

// 控制 page-container 的渲染，延迟销毁以避免滚动锁定问题
const shouldRenderAllCommentsPanel = ref(false);
const shouldRenderReviewHelper = ref(false);

watch(isAllCommentsPanelVisible, (val: boolean) => {
  if (val) {
    shouldRenderAllCommentsPanel.value = true;
  } else {
    setTimeout(() => {
      shouldRenderAllCommentsPanel.value = false;
    }, 300);
  }
});

watch(isReviewFormVisible, (val: boolean) => {
  if (val) {
    shouldRenderReviewHelper.value = true;
  } else {
    setTimeout(() => {
      shouldRenderReviewHelper.value = false;
    }, 300);
  }
});

// 拦截返回键，如果有弹窗打开则关闭弹窗而不是返回上一页
onBackPress(() => {
  if (isReviewFormVisible.value) {
    isReviewFormVisible.value = false;
    return true;
  }
  if (isAllCommentsPanelVisible.value) {
    hideAllCommentsPanel();
    return true;
  }
  if (isReportVisible.value) {
    closeReportModal();
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
      await fetchDishDetail(dishId.value);
    }
    uni.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1500
    });
  } catch (err) {
    console.error('下拉刷新失败:', err);
    uni.showToast({
      title: '刷新失败',
      icon: 'none'
    });
  } finally {
    uni.stopPullDownRefresh();
  }
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
    url: `/pages/dish/components/TagList?tag=${encodeURIComponent(tag)}&canteenId=${dish.value.canteenId}&canteenName=${encodeURIComponent(dish.value.canteenName || '')}`
  });
};

const goBack = () => {
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
  isReviewFormVisible.value = true;
};

const hideReviewForm = () => {
  isReviewFormVisible.value = false;
};

const handleReviewSuccess = async () => {
  hideReviewForm();
  
  // 等待弹窗关闭动画完成 (300ms duration + buffer)
  await new Promise(resolve => setTimeout(resolve, 350));
  
  // 刷新评价列表和菜品信息
  if (dishId.value) {
    await Promise.all([
      fetchReviews(dishId.value, true),
      fetchDishDetail(dishId.value)
    ]);
  }
  
  uni.showToast({
    title: '评价成功',
    icon: 'success',
  });
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
  if (!myReview.value) return;
  uni.showModal({
    title: '提示',
    content: '确定要删除你的这条评价吗？',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await removeReview(myReview.value!.id);
        if (dishId.value) {
          await Promise.all([
            fetchReviews(dishId.value, true),
            fetchDishDetail(dishId.value)
          ]);
        }
        uni.showToast({ title: '已删除', icon: 'success' });
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
  
  if (shouldRefreshDishDetail.value) {
    shouldRefreshDishDetail.value = false;
    
    // 等待面板关闭动画完成
    await new Promise(resolve => setTimeout(resolve, 350));
    
    if (dishId.value) {
      await Promise.all([
        fetchReviews(dishId.value, true),
        fetchDishDetail(dishId.value)
      ]);
    }
  }
};

const handleCommentAdded = async () => {
  const reviewId = currentCommentsReviewId.value;
  
  // 刷新该条评价的评论预览（列表页展示用）
  if (reviewId) {
    await fetchComments(reviewId);
  }
  
  // 标记需要刷新，待面板关闭后执行
  shouldRefreshDishDetail.value = true;
};
</script>

<style scoped>
.dish-swiper {
  width: 100%;
  height: 200px;
}

swiper {
  width: 100%;
}

swiper-item {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 旋转动画 */
.rotate-180 {
  transform: rotate(180deg);
}

/* 背景模糊效果 */
.blur-bg {
  filter: blur(20px);
  transform: scale(1.1); /* 稍微放大避免边缘露白 */
  opacity: 0.8;
}

.transition-transform {
  transition: transform 0.3s ease;
}

.transition-all {
  transition: all 0.3s ease-in-out;
}

/* 详细信息展开内容样式 */
.detail-section {
  margin-bottom: 12px;
  line-height: 1.5;
}

.detail-text {
  font-size: 14px;
  color: #000000;
}

</style>
