<template>
  <view class="review-form-overlay" @tap="handleClose">
    <view class="review-form-container" @tap.stop catchtouchmove="true">
      <!-- 标题栏 -->
      <view class="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
        <h2 class="text-lg font-bold text-gray-800">写评价</h2>
        <button
          class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          @tap="handleClose"
        >
          <text class="text-xl">✕</text>
        </button>
      </view>

      <!-- 评分选择 -->
      <view class="mb-5">
        <view class="text-sm font-medium text-gray-700 mb-3">选择评分</view>
        <view class="flex items-center justify-center gap-3 py-3">
          <text
            v-for="star in 5"
            :key="star"
            class="star-icon cursor-pointer transition-all"
            :class="star <= rating ? 'text-yellow-500' : 'text-gray-300'"
            :style="{
              fontSize: star <= rating ? '42px' : '38px'
            }"
            @tap="setRating(star)"
          >{{ star <= rating ? '★' : '☆' }}</text>
        </view>
        <view class="text-center text-sm text-gray-500">{{ ratingText }}</view>
      </view>

      <!-- 评价内容 -->
      <view class="mb-5">
        <view class="text-sm font-medium text-gray-700 mb-3">评价内容</view>
        <textarea
          v-model="content"
          class="w-full h-28 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-purple-400 transition-colors"
          placeholder="分享你的用餐体验吧~"
          maxlength="500"
        ></textarea>
        <view class="text-xs text-gray-400 text-right mt-2">
          {{ content.length }}/500
        </view>
      </view>

      <!-- 提交按钮 -->
      <button
        class="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg shadow-lg disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all hover:from-purple-600 hover:to-purple-700 active:scale-95"
        :disabled="!canSubmit || submitting"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : '提交评价' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { createReview } from '@/api/modules/review';

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

const rating = ref(5);
const content = ref('');
const submitting = ref(false);

const ratingText = computed(() => {
  const texts = ['', '非常差', '差', '一般', '好', '非常好'];
  return texts[rating.value] || '';
});

const canSubmit = computed(() => {
  return rating.value > 0 && content.value.trim().length >= 5;
});

const setRating = (star: number) => {
  rating.value = star;
};

const handleClose = () => {
  emit('close');
};

const handleSubmit = async () => {
  if (!canSubmit.value || submitting.value) return;

  submitting.value = true;

  try {
    const response = await createReview({
      dishId: props.dishId,
      rating: rating.value,
      content: content.value.trim(),
    });

    if (response.code === 200) {
      emit('success');
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
</script>

<style scoped>
textarea {
  font-family: inherit;
}

/* 背景遮罩 */
.review-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* 弹窗容器 */
.review-form-container {
  width: 100%;
  max-height: 80vh;
  background-color: #ffffff;
  border-radius: 12px 12px 0 0;
  padding: 20px 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  transform: translateY(100%);
  opacity: 0;
  animation: slide-up-from-bottom 0.3s ease-out forwards;
  overflow-y: auto;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

/* 从底部滑入动画 */
@keyframes slide-up-from-bottom {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.star-icon {
  display: inline-block;
  line-height: 1;
  user-select: none;
}
</style>
