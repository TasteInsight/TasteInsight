<template>
  <view class="fixed inset-0 bg-black/40 z-[9999] flex items-end justify-center" @tap="handleClose">
    <view class="review-form-container" @tap.stop catchtouchmove="true">
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
            class="cursor-pointer inline-block leading-none select-none transition-all duration-200"
            :class="star <= rating ? 'text-yellow-400 text-[42px] star-glow' : 'text-gray-300 text-[38px]'"
            @tap="setRating(star)"
          >{{ star <= rating ? '★' : '☆' }}</text>
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
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
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

const ratingText = computed(() => {
  const texts = ['', '非常差', '差', '一般', '好', '非常好'];
  return texts[rating.value] || '';
});


const setRating = (star: number) => {
  rating.value = star;
};

const handleClose = () => {
  emit('close');
};

const handleSubmit = async () => {
  if (submitting.value) return;

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

.review-form-container {
  width: 100%;
  max-height: 70vh;
  background-color: #ffffff;
  border-radius: 24px 24px 0 0;
  padding: 20px 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  transform: translateY(100%);
  opacity: 0;
  animation: slide-up-from-bottom 0.3s ease-out forwards;
  overflow-y: auto;
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
  margin-bottom: 80px;
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
