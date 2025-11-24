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
          <swiper-item v-for="(image, index) in dish.images" :key="index">
            <image 
              :src="image" 
              class="w-full h-full"
              mode="aspectFill"
            />
          </swiper-item>
        </swiper>
      </view>

      <!-- 基本信息 -->
      <view class="bg-white p-4 mb-2 rounded-2xl shadow-sm mx-4 mt-2">
        <view class="flex justify-between items-start">
          <view class="flex-1">
            <h1 class="text-xl font-bold text-gray-800">{{ dish.name }}</h1>
            <view class="text-sm text-purple-600 mt-1 flex items-center">
              <text class="iconify" data-icon="mdi:store"></text>
              <text class="ml-1">{{ dish.canteenName }} · {{ dish.windowName }}</text>
            </view>
          </view>
          <view class="text-right ml-4">
            <view class="text-2xl font-bold text-purple-600">¥{{ dish.price }}</view>
          </view>
        </view>

        <!-- 评分信息 -->
        <view class="flex items-center mt-3 py-3 border-t border-purple-100">
          <view class="flex items-center bg-purple-50 px-4 py-2 rounded-full">
            <text class="iconify text-yellow-500 text-xl" data-icon="mdi:star"></text>
            <span class="text-lg font-bold text-gray-800 ml-2">{{ dish.averageRating.toFixed(1) }}</span>
          </view>
          <view class="ml-4 text-sm text-gray-600">
            {{ dish.reviewCount }} 条评价
          </view>
        </view>

        <!-- 标签 -->
        <view v-if="dish.tags?.length" class="flex flex-wrap gap-2 mt-2">
          <span 
            v-for="tag in dish.tags" 
            :key="tag"
            class="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full font-medium"
          >
            {{ tag }}
          </span>
        </view>
      </view>

      <!-- 详细信息 -->
      <view class="bg-white p-4 mb-2 rounded-2xl shadow-sm mx-4">
        <view class="flex justify-between items-center mb-3 cursor-pointer" @click="toggleDetailExpansion">
          <h2 class="text-lg font-semibold text-gray-800">详细信息</h2>
          <text class="iconify text-purple-600 text-xl transition-transform duration-300" :class="isDetailExpanded ? 'rotate-180' : ''" data-icon="mdi:chevron-down"></text>
        </view>

        <view v-show="isDetailExpanded" class="transition-all duration-300 ease-in-out">
          <view v-if="dish.description" class="mb-2">
            <view class="text-sm text-gray-600 font-medium mb-1">菜品介绍</view>
            <view class="text-sm text-gray-700">{{ dish.description }}</view>
          </view>

          <view v-if="dish.ingredients?.length" class="mb-2">
            <view class="text-sm text-gray-600 font-medium mb-1">主要食材</view>
            <view class="text-sm text-gray-700">{{ dish.ingredients.join('、') }}</view>
          </view>

          <view v-if="dish.allergens?.length" class="mb-2">
            <view class="text-sm text-gray-600 font-medium mb-1">过敏原信息</view>
            <view class="text-sm text-red-500">⚠️ {{ dish.allergens.join('、') }}</view>
          </view>

          <view class="mb-2">
            <view class="text-sm text-gray-600 font-medium mb-1">供应时间</view>
            <view class="text-sm text-gray-700">
              {{ formatMealTime(dish.availableMealTime) }}
            </view>
          </view>
        </view>
      </view>

      <!-- 评价列表 -->
      <view class="bg-white p-4 mb-2 rounded-2xl shadow-sm mx-4">
        <view class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-800">用户评价</h2>
          <button 
            class="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-ts-purple text-sm rounded-full shadow-lg hover:from-purple-600 hover:to-purple-700 transition-all"
            @click="showReviewForm"
          >
            ✍️ 写评价
          </button>
        </view>

        <ReviewList 
          :dish-id="dishId" 
          :key="reviewListKey"
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

    <!-- 底部评价输入框 -->
    <BottomReviewInput
      v-if="dish"
      @click="showQuickReviewForm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';
import ReviewList from './components/ReviewList.vue';
import ReviewForm from './components/ReviewForm.vue';
import BottomReviewInput from './components/BottomReviewInput.vue';

const dishId = ref('');
const { dish, loading, error, fetchDishDetail } = useDishDetail();
const isReviewFormVisible = ref(false);
const reviewListKey = ref(0);
const isDetailExpanded = ref(false);

onLoad((options: any) => {
  if (options.id) {
    dishId.value = options.id;
    fetchDishDetail(options.id);
  }
});

const goBack = () => {
  uni.navigateBack();
};

const refresh = () => {
  if (dishId.value) {
    fetchDishDetail(dishId.value);
  }
};

const formatMealTime = (mealTimes: string[]) => {
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

.transition-transform {
  transition: transform 0.3s ease;
}

.transition-all {
  transition: all 0.3s ease-in-out;
}

</style>
