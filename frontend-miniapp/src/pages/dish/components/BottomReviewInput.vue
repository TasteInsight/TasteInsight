<template>
  <!-- 底部评价输入框，类似tabBar设计 -->
  <view class="bottom-review-input">
    <view class="review-input-container">
      <view
        class="review-input-box"
        @click="handleInputClick"
      >
        <text class="input-placeholder">写下你的评价...</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Emits {
  (e: 'click'): void;
}

const emit = defineEmits<Emits>();

const handleInputClick = () => {
  emit('click');
};
</script>

<style scoped>
.bottom-review-input {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #ffffff;
  border-top: 1px solid #e5e5e5;
  padding: 8px 12px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.review-input-container {
  max-width: 100%;
}

.review-input-box {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.review-input-box:active {
  background-color: #ebebeb;
  transform: scale(0.98);
}

.input-placeholder {
  flex: 1;
  color: #999999;
  font-size: 12px;
  margin-right: 8px;
}

.input-icon {
  font-size: 16px;
  color: #666666;
}

/* 适配不同屏幕尺寸 */
@media (max-width: 375px) {
  .bottom-review-input {
    padding: 6px 10px;
    padding-bottom: calc(6px + env(safe-area-inset-bottom));
  }

  .review-input-box {
    padding: 6px 10px;
  }

  .input-placeholder {
    font-size: 13px;
  }
}
</style>
