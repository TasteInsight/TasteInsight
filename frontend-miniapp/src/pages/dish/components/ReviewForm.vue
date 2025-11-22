<template>
  <view class="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50" @click.self="handleClose">
    <view class="w-full bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
      <!-- 标题栏 -->
      <view class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-800">评价 {{ dishName }}</h2>
        <button 
          class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          @click="handleClose"
        >
          <text class="iconify" data-icon="mdi:close"></text>
        </button>
      </view>

      <!-- 评分 -->
      <view class="mb-6">
        <view class="text-sm font-medium text-gray-700 mb-3">评分</view>
        <view class="flex items-center gap-2 bg-purple-50 p-4 rounded-xl">
          <text 
            v-for="star in 5" 
            :key="star"
            class="iconify text-4xl cursor-pointer transition-all"
            :class="star <= rating ? 'text-yellow-400' : 'text-gray-300'"
            data-icon="mdi:star"
            @click="setRating(star)"
          ></text>
          <span class="ml-3 text-lg font-semibold text-purple-600">{{ ratingText }}</span>
        </view>
      </view>

      <!-- 评价内容 -->
      <view class="mb-6">
        <view class="text-sm font-medium text-gray-700 mb-3">评价内容（至少5个字）</view>
        <textarea
          v-model="content"
          class="w-full h-32 p-4 border-2 border-purple-100 rounded-xl resize-none focus:outline-none focus:border-purple-400 transition-colors"
          placeholder="分享你的用餐体验吧~（至少5个字）"
          maxlength="500"
        ></textarea>
        <view class="text-xs text-gray-400 text-right mt-2">
          {{ content.length }}/500
        </view>
      </view>

      <!-- 提交按钮 -->
      <button 
        class="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all hover:from-purple-600 hover:to-purple-700"
        :disabled="!canSubmit || submitting"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : '✨ 提交评价' }}
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

.fixed {
  position: fixed;
}

.inset-0 {
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

.z-50 {
  z-index: 50;
}
</style>
