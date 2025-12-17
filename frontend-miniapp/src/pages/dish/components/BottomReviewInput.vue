<template>
  <!-- 底部操作栏，包含评价和收藏两个功能 -->
  <view class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[1000] shadow-[0_-2px_8px_rgba(0,0,0,0.1)]"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }">
    <view class="flex items-center justify-around h-[55px] px-4">
      <!-- 写评价按钮 -->
      <view 
        role="button"
        aria-label="写评价"
        class="flex flex-col items-center justify-center flex-1 cursor-pointer transition-all duration-200 active:scale-95"
        @click="handleReviewClick"
      >
        <text class="text-xl text-gray-600" aria-hidden="true">✎</text>
        <text class="text-xs text-gray-500">写评价</text>
      </view>

      <!-- 分隔线 -->
      <view class="w-px h-8 bg-gray-200" aria-hidden="true"></view>

      <!-- 收藏按钮 -->
      <view 
        role="button"
        :aria-label="isFavorited ? '取消收藏' : '收藏此菜品'"
        :aria-pressed="isFavorited"
        class="flex flex-col items-center justify-center flex-1 cursor-pointer transition-all duration-200"
        :class="favoriteLoading ? 'opacity-50' : 'active:scale-95'"
        @click="handleFavoriteClick"
      >
        <text 
          class="text-xl"
          :class="isFavorited ? 'text-yellow-400' : 'text-gray-400'"
          aria-hidden="true"
        >{{ isFavorited ? '★' : '☆' }}</text>
        <text class="text-xs" :class="isFavorited ? 'text-yellow-500' : 'text-gray-500'">
          {{ isFavorited ? '已收藏' : '收藏' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  isFavorited: boolean;
  favoriteLoading: boolean;
}

interface Emits {
  (e: 'review'): void;
  (e: 'favorite'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const handleReviewClick = () => {
  emit('review');
};

const handleFavoriteClick = () => {
  emit('favorite');
};
</script>

<style scoped>
/* Tailwind utilities are used for styling */
</style>
