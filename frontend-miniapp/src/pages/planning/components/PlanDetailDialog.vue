<template>
  <view v-if="visible" class="meal-detail-overlay" @tap="handleClose" @touchmove.stop.prevent>
    <view
      class="meal-detail-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="规划详情"
      @tap.stop
      @touchmove.stop
    >
      <view class="meal-detail-heading"
        ><text>规划详情</text
        ><button
          class="meal-detail-button meal-detail-close"
          aria-label="关闭规划详情"
          @tap="handleClose"
        >
          ×
        </button></view
      >
      <scroll-view v-if="plan" scroll-y class="meal-detail-scroll">
        <view class="meal-detail-summary"
          ><text class="meal-detail-date">{{ dateText }}</text
          ><text>{{ mealTimeText }}</text
          ><text v-if="plan.dishesReady" class="meal-detail-price">所列单价合计 ¥{{ totalPrice.toFixed(2) }}</text
          ><text v-else class="meal-detail-price">菜品资料尚未完整载入</text></view
        >
        <view class="meal-detail-list"
          ><text class="meal-detail-label">这一餐的菜品</text>
          <button
            v-for="dish in plan.dishes"
            :key="dish.id"
            class="meal-detail-button meal-detail-dish"
            @tap="goToDishDetail(dish.id)"
          >
            <image
              v-if="dish.images?.[0] && !failedImages[dish.images[0]]"
              :key="dish.images[0]"
              :src="dish.images[0]"
              class="meal-detail-image"
              mode="aspectFill"
              @error="failedImages[dish.images[0]] = true"
            />
            <view class="meal-detail-copy"
              ><text class="meal-detail-name">{{ dish.name }}</text
              ><text class="meal-detail-location"
                >{{ dish.canteenName || '食堂信息暂缺'
                }}{{ dish.windowName ? ' / ' + dish.windowName : '' }}</text
              ><text class="meal-detail-price"
                >¥{{ dish.price }}{{ dish.priceUnit ? '/' + dish.priceUnit : '' }}</text
              ></view
            >
          </button>
        </view>
      </scroll-view>
      <view class="meal-detail-footer"
        ><button class="meal-detail-button meal-detail-footer-button" @tap="handleClose">
          关闭
        </button></view
      >
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import dayjs from 'dayjs';

const props = defineProps<{ visible: boolean; plan: EnrichedMealPlan | null }>();
const emit = defineEmits<{ close: [] }>();
const failedImages = ref<Record<string, boolean>>({});
const mealTimeMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', nightsnack: '夜宵' };
const mealTimeText = computed(() => (props.plan ? mealTimeMap[props.plan.mealTime] || '用餐' : ''));
const totalPrice = computed(
  () => props.plan?.dishes.reduce((sum, dish) => sum + dish.price, 0) || 0
);
const dateText = computed(() => {
  if (!props.plan) return '';
  const start = dayjs(props.plan.startDate).format('YYYY年MM月DD日');
  return dayjs(props.plan.startDate).isSame(props.plan.endDate, 'day')
    ? start
    : start + ' — ' + dayjs(props.plan.endDate).format('YYYY年MM月DD日');
});
const goToDishDetail = (dishId: string) =>
  uni.navigateTo({ url: '/pages/dish/index?id=' + encodeURIComponent(dishId) });
const handleClose = () => emit('close');
</script>

<style scoped>
.meal-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 24, 39, 0.42);
  padding-top: env(safe-area-inset-top);
}
.meal-detail-sheet {
  width: 100%;
  max-width: 600px;
  max-height: 88vh;
  border-radius: 20px 20px 0 0;
  background: #fff;
  overflow: hidden;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.meal-detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 20px;
  font-weight: 600;
}
.meal-detail-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  line-height: 1.5;
}
.meal-detail-button::after {
  border: 0;
}
.meal-detail-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.meal-detail-button:active {
  opacity: 0.72;
}
.meal-detail-close {
  width: 44px;
  font-size: 26px;
  color: #667085;
}
.meal-detail-scroll {
  max-height: calc(88vh - 146px - env(safe-area-inset-bottom));
}
.meal-detail-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  font-size: 14px;
}
.meal-detail-date {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.6;
}
.meal-detail-price {
  display: block;
  font-weight: 600;
  font-size: 14px;
}
.meal-detail-list {
  padding: 0 20px 16px;
}
.meal-detail-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 4px;
}
.meal-detail-sheet .meal-detail-dish {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  text-align: left;
}
.meal-detail-image {
  order: 1;
  width: 68px;
  height: 68px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #f7f8fa;
}
.meal-detail-copy {
  flex: 1;
  min-width: 0;
}
.meal-detail-name {
  display: block;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.meal-detail-location {
  display: block;
  color: #667085;
  font-size: 12px;
  margin: 4px 0;
  overflow-wrap: anywhere;
}
.meal-detail-footer {
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #e5e7eb;
}
.meal-detail-footer-button {
  width: 100%;
  background: #f7f8fa;
  color: #1f2937;
  font-size: 15px;
  border-radius: 8px;
}
</style>
