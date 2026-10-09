<template>
  <view class="dish-actions">
    <button
      class="dish-action-button dish-action-secondary"
      :class="{ 'is-favorited': isFavorited, 'dish-action-disabled': favoriteLoading }"
      :aria-label="isFavorited ? '取消收藏' : '收藏此菜品'"
      :aria-pressed="isFavorited"
      :disabled="favoriteLoading"
      @click="emit('favorite')"
    >
      <text class="dish-action-icon" aria-hidden="true">{{ isFavorited ? '★' : '☆' }}</text
      ><text>{{ isFavorited ? '已收藏' : '收藏' }}</text>
    </button>
    <button
      class="dish-action-button dish-action-secondary"
      aria-label="加入规划"
      @click="emit('plan')"
    >
      <text class="dish-action-icon" aria-hidden="true">＋</text><text>加入规划</text>
    </button>
    <button
      class="dish-action-button dish-action-primary"
      :class="{ 'dish-action-disabled': reviewLoading || reviewDisabled }"
      :aria-label="hasReview ? '修改评价' : '写评价'"
      :disabled="reviewLoading || reviewDisabled"
      @click="emit('review')"
    >
      {{
        reviewLoading
          ? '读取评价中…'
          : reviewDisabled
            ? '评价暂不可用'
            : hasReview
              ? '修改评价'
              : '写评价'
      }}
    </button>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  isFavorited: boolean;
  favoriteLoading: boolean;
  hasReview?: boolean;
  reviewLoading?: boolean;
  reviewDisabled?: boolean;
}>();
const emit = defineEmits<{ (e: 'review'): void; (e: 'favorite'): void; (e: 'plan'): void }>();
</script>

<style scoped>
.dish-actions {
  position: fixed;
  bottom: var(--window-bottom, 0px);
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid #e5e7eb;
  background: #fff;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.dish-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  min-height: 44px;
  border: 0;
  line-height: 1.4;
  font-family: inherit;
}
.dish-action-button::after {
  border: 0;
}
.dish-action-button:active {
  opacity: 0.72;
}
.dish-action-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.dish-action-secondary {
  flex-direction: column;
  min-width: 52px;
  color: #667085;
  background: #fff;
  font-size: 12px;
}
.dish-action-icon {
  font-size: 21px;
  line-height: 24px;
}
.dish-action-secondary.is-favorited {
  color: #660874;
}
.dish-action-secondary.dish-action-disabled {
  opacity: 0.5;
}
.dish-action-primary {
  flex: 1;
  background: #660874;
  color: #fff;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
}
.dish-action-primary.dish-action-disabled {
  background: #f4f4f5;
  color: #667085;
}
</style>
