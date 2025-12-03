<template>
  <view class="fixed inset-0 bg-black/40 z-[9999] flex items-end justify-center" @tap="handleClose">
    <scroll-view 
      class="review-form-container" 
      scroll-y 
      :scroll-with-animation="true"
      @tap.stop
    >
      <!-- 标题栏 -->
      <view class="flex justify-center items-center mb-4 pb-4 border-b border-gray-100 relative">
        <h2 class="text-lg font-bold text-gray-800">写评价</h2>
        <button
          class="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 text-xl rounded-full bg-transparent border-0 after:border-none"
          @tap="handleClose"
        >
          <text>✕</text>
        </button>
      </view>

      <!-- 评分选择 -->
      <view class="mb-5">
        <view class="text-sm font-medium text-gray-700 mb-1 text-center">{{ ratingText }}</view>
        <view class="flex items-center justify-center gap-3 py-1">
          <text
            v-for="star in 5"
            :key="star"
            class="cursor-pointer inline-block leading-none select-none transition-all duration-200 star-glow"
            :style="{ fontSize: star <= rating ? '48px' : '40px', color: star <= rating ? '#fbbf24' : '#d1d5db' }"
            @tap="setRating(star)"
          >{{ star <= rating ? '★' : '☆' }}</text>
        </view>
      </view>

      <!-- 口味细节评分-->
      <view v-if="rating > 0" class="mb-5 flavor-section">
        <view class="flex items-center justify-between mb-3">
          <view class="text-sm font-medium text-gray-700">口味细节（可选）</view>
          <button
            v-if="hasFlavorSelection"
            class="px-3 py-1.5 text-sm font-medium text-ts-purple bg-purple-50 border border-purple-200 rounded-full hover:bg-purple-100 active:bg-purple-200 transition-colors duration-200"
            @tap="resetFlavorRatings"
          >清除选择</button>
        </view>

        <view
          v-for="option in flavorOptions"
          :key="option.key"
          class="relative flex items-center py-4"
        >
          <text class="text-gray-700 text-base font-medium">{{ option.label }}</text>
          <view class="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
            <text
              v-for="star in 5"
              :key="star"
              class="cursor-pointer inline-block leading-none select-none transition-all duration-200"
              :style="{ fontSize: star <= flavorRatings[option.key] ? '40px' : '32px', color: star <= flavorRatings[option.key] ? '#fbbf24' : '#d1d5db' }"
              @tap="setFlavorRating(option.key, star)"
            >{{ star <= flavorRatings[option.key] ? '★' : '☆' }}</text>
          </view>
        </view>

        <view v-if="showFlavorError && !flavorSelectionComplete" class="text-xs text-red-500 mt-2">
          请选择全部口味评分或全部留空
        </view>
      </view>

      <!-- 评价内容 -->
      <view class="mb-5">
        <view class="text-sm font-medium text-gray-700 mb-3">评价内容</view>
        <textarea
          v-model="content"
          class="w-full h-28 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-purple-400 transition-colors bg-white"
          placeholder="分享你的用餐体验吧~"
          maxlength="500"
        ></textarea>
        <view class="text-xs text-gray-400 text-right mt-2">
          {{ content.length }}/500
        </view>
      </view>

      <!-- 提交按钮 -->
      <button
        class="w-full h-10 flex items-center justify-center font-medium rounded-md transition-all shadow-lg shadow-purple-200 active:shadow-none bg-purple-900 text-white disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed"
        :disabled="submitting"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : '提交评价' }}
      </button>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick } from 'vue';
import { useReviewForm } from '../composables/use-review';

interface Props {
  dishId: string;
  dishName: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const {
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
  handleSubmit: submitForm
} = useReviewForm();

// 隐藏tabbar
onMounted(() => {
  nextTick(() => {
    // 添加CSS类来隐藏tabbar
    document.body.classList.add('hide-tabbar');

    // 同时尝试API隐藏
    setTimeout(() => {
      uni.hideTabBar({
        animation: true,
        fail: (err) => {
          console.log('API隐藏tabbar失败，使用CSS隐藏');
        }
      });
    }, 100);
  });
});

// 显示tabbar
onUnmounted(() => {
  // 移除CSS类
  document.body.classList.remove('hide-tabbar');

  setTimeout(() => {
    uni.showTabBar({
      animation: true,
      fail: (err) => {
        console.log('API显示tabbar失败');
      }
    });
  }, 200);
});

const handleClose = () => {
  emit('close');
};

const handleSubmit = () => {
  submitForm(props.dishId, () => {
    emit('success');
  });
};
</script>

<style scoped>
textarea {
  font-family: inherit;
}

.review-form-container {
  width: 100%;
  max-height: 85vh;
  background-color: #ffffff;
  border-radius: 24px 24px 0 0;
  padding: 20px 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  transform: translateY(100%);
  opacity: 0;
  animation: slide-up-from-bottom 0.3s ease-out forwards;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
  margin-bottom: 80px;
}

.flavor-section {
  animation: fade-in 0.3s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-up-from-bottom {
  from {
    transform: translateY(120%);
    opacity: 0;
  }
  to {
    transform: translateY(20%);
    opacity: 1;
  }
}

.star-glow {
  animation: star-glow 0.3s ease;
}

@keyframes star-glow {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.review-form-container button::after {
  border: none;
}

.hide-tabbar .uni-tabbar,
.hide-tabbar uni-tabbar {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}
</style>
