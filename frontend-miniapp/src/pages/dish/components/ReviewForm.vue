<template>
  <view class="review-form-overlay" @tap="handleClose">
    <view class="review-form-container" @tap.stop catchtouchmove="true">
      <!-- 标题栏 -->
      <view class="flex justify-center items-center mb-4 pb-4 border-b border-gray-100 relative">
        <h2 class="text-lg font-bold text-gray-800">写评价</h2>
        <button
          class="close-btn"
          @tap="handleClose"
        >
          <text class="text-xl">✕</text>
        </button>
      </view>

      <!-- 评分选择 -->
      <view class="mb-5">
        <view class="text-sm font-medium text-gray-700 mb-1 text-center">{{ ratingText }}</view>
        <view class="flex items-center justify-center gap-3 py-1">
          <text
            v-for="star in 5"
            :key="star"
            class="star-icon cursor-pointer star-transition"
            :class="star <= rating ? 'star-active' : 'star-inactive'"
            :style="{
              fontSize: star <= rating ? '42px' : '38px'
            }"
            @tap="setRating(star)"
          >{{ star <= rating ? '★' : '☆' }}</text>
        </view>
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
        class="w-full py-0.5 font-medium rounded-md transition-all submit-btn"
        :disabled="submitting"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : '提交评价' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
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

/* 背景遮罩 */
.review-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 9999; /* 提高z-index */
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* 弹窗容器 */
.review-form-container {
  width: 100%;
  max-height: 70vh; /* 稍微降低高度 */
  background-color: #ffffff;
  border-radius: 12px 12px 0 0;
  padding: 20px 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  transform: translateY(100%);
  opacity: 0;
  animation: slide-up-from-bottom 0.3s ease-out forwards;
  overflow-y: auto;
  padding-bottom: calc(100px + env(safe-area-inset-bottom)); /* 进一步增加底部padding */
  margin-bottom: 80px; /* 增加底部间距 */
}

/* 从底部滑入动画 */
@keyframes slide-up-from-bottom {
  from {
    transform: translateY(120%); /* 从更低的位置开始，覆盖tabbar */
    opacity: 0;
  }
  to {
    transform: translateY(20%); /* 最终位置稍微往下，覆盖tabbar */
    opacity: 1;
  }
}

.star-icon {
  display: inline-block;
  line-height: 1;
  user-select: none;
}

.star-transition {
  transition: color 0.3s ease, transform 0.2s ease;
}

.star-active {
  color: #eab308; /* 金黄色 */
  animation: star-glow 0.3s ease;
}

.star-inactive {
  color: #d1d5db; /* 灰色 */
}

@keyframes star-glow {
  0% {
    color: #d1d5db;
    transform: scale(1);
  }
  50% {
    color: #eab308;
    transform: scale(1.1);
  }
  100% {
    color: #eab308;
    transform: scale(1);
  }
}

.close-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  border-radius: 50%;
  background: transparent;
  border: none;
}

.close-btn:hover {
  background-color: #f3f4f6;
  color: #4b5563;
}

.submit-btn {
  background-color: #a855f7 !important; /* purple-500 的颜色值，比原来的 purple-700 浅 */
  color: #ffffff !important;
}

.submit-btn[disabled] {
  background-color: #d1d5db !important; /* gray-300 */
  color: #9ca3af !important; /* gray-400 */
  cursor: not-allowed;
}
/* 隐藏tabbar的样式 */
.hide-tabbar .uni-tabbar,
.hide-tabbar uni-tabbar {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}
</style>
