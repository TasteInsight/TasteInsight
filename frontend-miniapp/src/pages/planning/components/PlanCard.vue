<template>
  <view class="meal-card" @tap="emit('view')">
    <view class="meal-card-heading"
      ><view class="meal-card-title"
        ><text>{{ dateText }}</text
        ><text class="meal-card-time">{{ mealTimeText }}</text></view
      ><view class="meal-card-tools"
        ><button
          v-if="!isHistory"
          class="meal-card-button"
          aria-label="编辑规划"
          :disabled="!plan.dishesReady"
          @tap.stop="emit('edit')"
        >
          编辑</button
        ><button class="meal-card-button" aria-label="删除规划" @tap.stop="emit('delete')">
          删除
        </button></view
      ></view
    >
    <view v-for="dish in plan.dishes" :key="dish.id" class="meal-card-dish">
      <image
        v-if="dish.images?.[0] && !failedImages[dish.images[0]]"
        :key="dish.images[0]"
        :src="dish.images[0]"
        class="meal-card-image"
        mode="aspectFill"
        @error="failedImages[dish.images[0]] = true"
      />
      <view class="meal-card-copy"
        ><text class="meal-card-name">{{ dish.name }}</text
        ><text class="meal-card-location"
          >{{ dish.canteenName || '食堂信息暂缺'
          }}{{ dish.windowName ? ' / ' + dish.windowName : '' }}</text
        ><view class="meal-card-meta"
          ><text class="meal-card-price"
            >¥{{ dish.price }}{{ dish.priceUnit ? '/' + dish.priceUnit : '' }}</text
          ><text
            class="meal-card-rating"
            :class="{ 'meal-card-rating-rated': dish.averageRating > 0 }"
            >{{
            dish.averageRating ? dish.averageRating.toFixed(1) + '分' : '暂无评分'
          }}</text></view
        ></view
      >
    </view>
    <view class="meal-card-footer"
      ><text v-if="plan.dishesReady" class="meal-card-total">所列单价合计 ¥{{ totalPrice.toFixed(2) }}</text
      ><text v-else class="meal-card-status">菜品资料尚未完整载入</text
      ><button
        v-if="!isHistory"
        class="meal-card-button meal-card-complete"
        @tap.stop="emit('execute')"
      >
        标记已吃</button
      ><text v-else class="meal-card-status">{{
        plan.isCompleted ? '已标记吃过' : '未标记吃过'
      }}</text></view
    >
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import dayjs from 'dayjs';

const props = defineProps<{ plan: EnrichedMealPlan; isHistory?: boolean }>();
const emit = defineEmits<{
  (e: 'view'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'execute'): void;
}>();
const failedImages = ref<Record<string, boolean>>({});
const mealTimeMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', nightsnack: '夜宵' };
const mealTimeText = computed(() => mealTimeMap[props.plan.mealTime] || '用餐');
const totalPrice = computed(() => props.plan.dishes.reduce((sum, dish) => sum + dish.price, 0));
const dateText = computed(() => {
  const start = dayjs(props.plan.startDate).format('MM月DD日');
  return dayjs(props.plan.startDate).isSame(props.plan.endDate, 'day')
    ? start
    : start + ' — ' + dayjs(props.plan.endDate).format('MM月DD日');
});
</script>

<style scoped>
.meal-card {
  width: 100%;
  box-sizing: border-box;
  padding: 16px 0 20px;
  margin-bottom: 4px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.meal-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 12px;
}
.meal-card-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  padding-top: 6px;
}
.meal-card-time {
  display: block;
  font-size: 13px;
  color: #660874;
  font-weight: 500;
}
.meal-card-tools {
  display: flex;
  flex-shrink: 0;
}
.meal-card-button {
  min-height: 44px;
  min-width: 44px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: #667085;
  font-size: 13px;
  line-height: 44px;
}
.meal-card-button::after {
  border: 0;
}
.meal-card-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.meal-card-button:active {
  opacity: 0.7;
}
.meal-card-dish {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.meal-card-image {
  order: 1;
  width: 68px;
  height: 68px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #f7f8fa;
}
.meal-card-copy {
  min-width: 0;
  flex: 1;
}
.meal-card-name {
  display: block;
  font-size: 15px;
  font-weight: 500;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.meal-card-location {
  display: block;
  margin-top: 3px;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.meal-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 5px;
}
.meal-card-price {
  color: var(--color-price, #2f6b50);
  font-size: 14px;
  font-weight: 600;
}
.meal-card-rating {
  font-size: 12px;
  color: #667085;
}
.meal-card-rating-rated {
  color: var(--color-rating, #946200);
}
.meal-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}
.meal-card-total {
  font-size: 13px;
  color: #667085;
}
.meal-card .meal-card-complete {
  padding: 0 16px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #660874;
  border-radius: 8px;
  font-size: 14px;
}
.meal-card-status {
  color: #667085;
  font-size: 12px;
}
</style>
