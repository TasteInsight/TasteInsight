<template>
  <view class="planning-card">
    <view class="planning-card-header" :class="{ 'planning-card-header-expanded': !collapsed }">
      <image class="planning-header-icon" src="/static/icons/plan.png" aria-hidden="true" />
      <view class="planning-card-heading">
        <text class="planning-card-title">{{
          mealText ? `${mealText}规划建议` : '饮食规划建议'
        }}</text>
        <text class="planning-card-date">{{ dateText }}</text>
        <text v-if="collapsed && plan.appliedStatus" class="planning-card-status">{{
          appliedButtonText
        }}</text>
      </view>
      <button
        class="planning-card-toggle"
        hover-class="planning-control-pressed"
        :hover-stay-time="80"
        role="button"
        tabindex="0"
        :aria-label="collapsed ? '展开规划建议' : '收起规划建议'"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
        @keydown="handleToggleKeydown"
        @keyup="handleToggleKeyup"
        @blur="togglePressed = false"
      >
        {{ collapsed ? '展开' : '收起' }}
        <image
          class="planning-header-icon"
          :src="collapsed ? '/static/icons/chevron-down.png' : '/static/icons/chevron-up.png'"
          aria-hidden="true"
        />
      </button>
    </view>

    <template v-if="!collapsed">
      <view v-if="plan.summary" class="mb-3">
        <text class="text-sm text-gray-600 leading-relaxed block">{{ plan.summary }}</text>
      </view>

      <view v-if="preview?.dishes?.length">
        <view v-for="dish in preview.dishes" :key="dish.id" class="planning-dish">
          <view class="planning-dish-info">
            <text class="font-medium text-base block">{{ dish.name }}</text>
            <text class="text-sm text-gray-500 mt-1 block">{{ dish.canteenName }}</text>
            <view class="flex justify-between items-center mt-2">
              <text class="planning-dish-price"
                >¥{{ Number(dish.price || 0).toFixed(1)
                }}{{ dish.priceUnit ? `/${dish.priceUnit}` : '' }}</text
              >
              <view class="flex items-center" v-if="typeof dish.averageRating === 'number'">
                <text
                  class="planning-dish-rating"
                  :class="{ 'planning-dish-rating-rated': dish.averageRating > 0 }"
                  >{{
                    dish.averageRating === 0 ? '暂无评分' : `${dish.averageRating.toFixed(1)} 分`
                  }}</text
                >
              </view>
            </view>
          </view>
          <image
            v-if="dish.images?.[0] && !failedImages.includes(dish.images[0])"
            :src="dish.images[0]"
            class="planning-dish-image"
            mode="aspectFill"
            @error="failedImages.push(dish.images[0])"
          />
        </view>
      </view>

      <view class="planning-card-footer">
        <text class="planning-price-total">所列单价合计：¥{{ totalPrice.toFixed(1) }}</text>
        <view class="planning-card-actions">
          <button
            class="planning-card-apply"
            hover-class="planning-control-pressed"
            :hover-stay-time="80"
            role="button"
            :tabindex="plan.appliedStatus === 'success' ? -1 : 0"
            :aria-disabled="plan.appliedStatus === 'success'"
            :disabled="plan.appliedStatus === 'success'"
            @click="handleApply"
            @keydown="handleApplyKeydown"
            @keyup="handleApplyKeyup"
            @blur="applyPressed = false"
          >
            {{ appliedButtonText }}
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import type { ComponentMealPlanDraft } from '@/types/api';

const props = defineProps<{
  plan: ComponentMealPlanDraft & { appliedStatus?: 'success' | 'failed' };
}>();

const emit = defineEmits<{
  (e: 'apply', plan: ComponentMealPlanDraft): void;
}>();

const collapsed = ref(true);
const failedImages = ref<string[]>([]);
const togglePressed = ref(false);
const applyPressed = ref(false);

const handleToggleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  togglePressed.value = true;
};
const handleToggleKeyup = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (togglePressed.value) {
    togglePressed.value = false;
    collapsed.value = !collapsed.value;
  }
};
const handleApplyKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    applyPressed.value = true;
  }
};
const handleApplyKeyup = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (applyPressed.value) {
    applyPressed.value = false;
    handleApply();
  }
};

const appliedButtonText = computed(() => {
  if (props.plan.appliedStatus === 'success') return '已加入';
  if (props.plan.appliedStatus === 'failed') return '加入失败，重试';
  return '加入我的规划';
});

const preview = computed(() => props.plan.previewData);

const mealTimeMap: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  nightsnack: '夜宵',
};

const dateText = computed(() => {
  const p = preview.value;
  if (!p?.startDate) return '饮食规划建议';
  const startText = dayjs(p.startDate).format('MM月DD日');
  const dateText =
    p.endDate && p.endDate !== p.startDate
      ? `${startText} — ${dayjs(p.endDate).format('MM月DD日')}`
      : startText;
  return dateText;
});
const mealText = computed(() =>
  preview.value ? mealTimeMap[preview.value.mealTime] || '用餐' : ''
);

const totalPrice = computed(() => {
  const list = preview.value?.dishes || [];
  return list.reduce((sum, dish) => sum + Number((dish as any).price || 0), 0);
});

const handleApply = () => {
  if (props.plan.appliedStatus === 'success') return;
  emit('apply', props.plan);
};
</script>

<style scoped>
.planning-card {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 0;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}
.planning-card-date {
  display: block;
  color: #667085;
  font-size: 13px;
  font-weight: 400;
  margin-top: 2px;
}
.planning-header-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.planning-dish {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}
.planning-dish-image {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 10px;
}
.planning-dish-info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.planning-dish-price {
  color: var(--color-price, #2f6b50);
  font-size: 14px;
  font-weight: 600;
}
.planning-dish-rating {
  color: #667085;
  font-size: 12px;
}
.planning-dish-rating-rated {
  color: var(--color-rating, #946200);
}
.planning-card-footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}
.planning-price-total {
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
.planning-card-actions {
  display: flex;
  justify-content: flex-end;
}
.planning-card-apply {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  min-width: 128px;
  padding: 0 16px;
  margin: 0;
  border: 0;
  border-radius: 10px;
  color: #fff;
  background: #660874;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 140ms ease-out;
}
.planning-card-apply::after {
  border: none;
}
.planning-card-apply[disabled] {
  color: #667085;
  background: #f7f8fa;
}
.planning-card-apply:not([disabled]):active {
  opacity: 0.8;
}
.planning-card-apply.planning-control-pressed:not([disabled]) {
  background: #50065b;
}
.planning-card-toggle.planning-control-pressed {
  background: #f4f4f5;
}
@media (hover: hover) {
  .planning-card-apply:not([disabled]):hover {
    background: #50065b;
  }
  .planning-card-toggle:hover {
    background: #f7f8fa;
  }
}
.planning-card-apply:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.planning-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: system-ui, sans-serif;
}
.planning-card-header-expanded {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}
.planning-card-heading {
  flex: 1;
  min-width: 0;
}
.planning-card-title {
  display: block;
  color: #1f2937;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: normal;
}
.planning-card-status {
  display: block;
  color: #667085;
  font-size: 13px;
  margin-top: 4px;
}
.planning-card-toggle {
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0 0 0 8px;
  gap: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667085;
  background: #fff;
  border: none;
  font-size: 13px;
  line-height: 1.5;
}
.planning-card-toggle::after {
  border: none;
}
.planning-card-toggle:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
