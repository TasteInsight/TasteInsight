<template>
  <view class="min-h-screen bg-gradient-to-b from-purple-50 to-white pt-16">
    <!-- 加载状态 -->
    <view v-if="loading" class="flex items-center justify-center min-h-screen">
      <text class="text-purple-500">加载中...</text>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="error" class="flex items-center justify-center min-h-screen">
      <view class="text-center">
        <text class="text-red-500">{{ error }}</text>
        <button 
          class="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
      <view class="bg-white p-4 mb-2 rounded-2xl shadow-sm mx-4 mt-2">
        <view class="flex justify-between items-start mb-2">
          <view class="flex-1">
            <h1 class="text-xl font-bold text-gray-800">{{ dish.name }}</h1>
            <view class="text-sm text-red-600 mt-1 flex items-center">
              <text class="iconify" data-icon="mdi:store"></text>
              <text class="ml-1">{{ dish.canteenName }} · {{ dish.windowName }}</text>
            </view>
          </view>
          <view class="text-right mt-2">
            <view class="text-lg font-bold text-red-600">¥{{ dish.price }}</view>
          </view>
        </view>

        <!-- 标签 -->
        <view v-if="dish.tags?.length" class="flex flex-wrap gap-2">
          <span
            v-for="tag in dish.tags"
            :key="tag"
            class="px-3 py-1 bg-blue-50 text-blue-500 text-xs rounded-md font-medium"
          >
            #{{ tag }}
          </span>
        </view>

        <!-- 评分信息 -->
        <view class="mt-3 py-3 border-t border-purple-100">
          <view class="flex justify-between items-start">
            <!-- 左侧评分和评价数量 -->
            <view class="flex flex-col mt-8">
              <view class="text-xl font-bold text-purple-600">
                {{ dish.averageRating.toFixed(1) }}分
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
      
      <!-- 详细信息 -->
      <view class="bg-white p-4 mb-2 rounded-xl shadow-sm mx-4">
        <view class="flex justify-between items-center mb-3 cursor-pointer" @click="toggleDetailExpansion">
          <h2 class="text-lg font-semibold text-gray-800">详细信息 ...</h2>
          <text class="iconify text-red-600 text-xl transition-transform duration-300" :class="isDetailExpanded ? 'rotate-180' : ''" data-icon="mdi:chevron-down"></text>
        </view>

        <view v-show="isDetailExpanded" class="transition-all duration-300 ease-in-out">
          <!-- 菜品介绍 -->
          <view v-if="dish.description" class="detail-section">
            <text class="detail-label">菜品介绍：</text>
            <text class="detail-text">{{ dish.description }}</text>
          </view>

          <!-- 主要食材 -->
          <view v-if="dish.ingredients?.length" class="detail-section">
            <text class="detail-label">主要食材：</text>
            <text class="detail-text">{{ dish.ingredients.join('、') }}</text>
          </view>

          <!-- 过敏原信息 -->
          <view v-if="dish.allergens?.length" class="detail-section">
            <text class="detail-label">过敏原信息：</text>
            <text class="detail-text text-red-600">{{ dish.allergens.join('、') }}</text>
          </view>

          <!-- 供应时间 -->
          <view class="detail-section">
            <text class="detail-label">供应时间：</text>
            <text class="detail-text">{{ formatMealTime(dish.availableMealTime) }}</text>
          </view>

          <!-- 子菜品（如果有） -->
          <view v-if="subDishes.length > 0" class="detail-section mt-3">
            <text class="detail-label">子菜品：</text>
            <view class="mt-2 space-y-3">
              <view
                v-for="sub in displayedSubDishes"
                :key="sub.id"
                class="bg-gray-50 p-3 rounded-lg flex items-center gap-3 cursor-pointer"
                @click="goToSubDish(sub.id)"
              >
                <image v-if="sub.images?.[0]" :src="sub.images[0]" class="w-14 h-14 rounded-md object-cover" mode="aspectFill" />
                <view v-else class="w-14 h-14 bg-gray-200 rounded-md flex items-center justify-center">
                  <text class="iconify text-gray-400" data-icon="mdi:food"></text>
                </view>
                <view class="flex-1 min-w-0">
                  <view class="font-medium text-sm text-gray-800 truncate">{{ sub.name }}</view>
                  <view class="text-xs text-red-600 mt-1">¥{{ sub.price }}</view>
                </view>
                <text class="iconify text-gray-400" data-icon="mdi:chevron-right"></text>
              </view>
            </view>
            <!-- 展开/收起按钮 -->
            <view
              v-if="subDishes.length > 3"
              class="mt-3 text-center"
            >
              <button
                class="text-sm text-purple-600 bg-purple-50 px-4 py-2 rounded-full"
                @click="isSubDishesExpanded = !isSubDishesExpanded"
              >
                {{ isSubDishesExpanded ? '收起' : `展开全部 (${subDishes.length}个)` }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <!-- 评价列表 -->
      <view class="bg-white p-4 mb-2 rounded-xl shadow-sm mx-4">
        <view class="mb-4">
          <h2 class="text-lg font-semibold text-gray-800">用户评价</h2>
        </view>

        <ReviewList
          :dish-id="dishId"
          :key="reviewListKey"
          @view-all-comments="showAllCommentsPanel"
        />
      </view>
    </view>

    <!-- 评价表单弹窗 -->
    <ReviewForm
      v-if="isReviewFormVisible"
      :dish-id="dishId"
      :dish-name="dish?.name || ''"
      @close="hideReviewForm"
      @success="handleReviewSuccess"
    />

    <!-- 全部评论面板 -->
    <AllCommentsPanel
      v-if="isAllCommentsPanelVisible"
      :review-id="currentCommentsReviewId"
      :is-visible="isAllCommentsPanelVisible"
      @close="hideAllCommentsPanel"
      @comment-added="handleCommentAdded"
    />

    <!-- 底部评价输入框 -->
    <BottomReviewInput
      v-if="dish"
      @click="showQuickReviewForm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';
import ReviewList from './components/ReviewList.vue';
import ReviewForm from './components/ReviewForm.vue';
import BottomReviewInput from './components/BottomReviewInput.vue';
import AllCommentsPanel from './components/AllCommentsPanel.vue';
import RatingBars from './components/RatingBars.vue';
import { getDishById } from '@/api/modules/dish';

const dishId = ref('');
const { dish, loading, error, fetchDishDetail } = useDishDetail();
const isReviewFormVisible = ref(false);
const reviewListKey = ref(0);
const isDetailExpanded = ref(false);
const isAllCommentsPanelVisible = ref(false);
const currentCommentsReviewId = ref('');
const subDishes = ref<any[]>([]);
const isSubDishesExpanded = ref(false);

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

// 加载子菜品（如果有）
const loadSubDishes = async () => {
  subDishes.value = [];
  const ids = dish.value?.subDishId || [];
  if (!ids || ids.length === 0) return;

  try {
    const promises = ids.map((id: string) => getDishById(id));
    const results = await Promise.all(promises);
    const items = results
      .filter((r: any) => r && r.code === 200 && r.data)
      .map((r: any) => r.data);
    subDishes.value = items;
  } catch (err) {
    console.error('加载子菜品失败', err);
  }
};

// 监听 dish 变化以加载子项
watch(() => dish.value, (val) => {
  if (val) loadSubDishes();
});

// 跳转到子菜品详情
const goToSubDish = (id: string) => {
  if (!id) return;
  uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
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

const handleReviewSuccess = () => {
  hideReviewForm();
  // 刷新评价列表
  reviewListKey.value++;
  // 刷新菜品信息（更新评分）
  refresh();
  uni.showToast({
    title: '评价成功',
    icon: 'success',
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

const hideAllCommentsPanel = () => {
  isAllCommentsPanelVisible.value = false;
  currentCommentsReviewId.value = '';
};

const handleCommentAdded = () => {
  // 刷新评论列表
  reviewListKey.value++;
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

.detail-label {
  font-size: 14px;
  font-weight: normal;
  color: #7c3aed;
  margin-right: 4px;
}

.detail-text {
  font-size: 14px;
  color: #000000;
}

</style>
