<template>
  <view class="planning-card">
    <view class="planning-card-header" :class="{ 'planning-card-header-expanded': !collapsed }">
      <image class="planning-header-icon" src="/static/icons/plan.png" aria-hidden="true" />
      <view class="planning-card-heading">
        <text class="planning-card-title">{{
          mealText ? t('social.mealSuggestion', { p0: mealText }) : t('social.mealPlanSuggestion')
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
        :aria-label="
          collapsed ? t('social.expandPlanSuggestion') : t('social.collapsePlanSuggestion')
        "
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
        @keydown="handleToggleKeydown"
        @keyup="handleToggleKeyup"
        @blur="togglePressed = false"
      >
        {{ collapsed ? t('social.expand') : t('social.collapse') }}
        <image
          class="planning-header-icon"
          :src="collapsed ? '/static/icons/chevron-down.png' : '/static/icons/chevron-up.png'"
          aria-hidden="true"
        />
      </button>
    </view>

    <text v-if="collapsed && changeSummary" class="planning-change-summary" role="status">{{
      changeSummary
    }}</text>

    <template v-if="!collapsed">
      <text v-if="plan.summary" class="planning-summary">{{ plan.summary }}</text>

      <view v-if="preview?.dishes?.length">
        <view v-for="dish in preview.dishes" :key="dish.id" class="planning-dish">
          <view class="planning-dish-info">
            <view class="planning-dish-heading">
              <text class="planning-dish-name">{{ dish.name }}</text>
              <TagBadge
                v-if="dishStatusLabel(dish)"
                :label="dishStatusLabel(dish)"
                tone="neutral"
              />
            </view>
            <text class="planning-dish-location">{{ dish.canteenName }}</text>
            <text
              v-for="notice in dishSupplyNotices(dish)"
              :key="notice"
              class="planning-dish-supply"
              >{{ notice }}</text
            >
            <DishNutrition :dish="dish" />
            <view class="planning-dish-details">
              <view class="planning-dish-price-group">
                <text class="planning-dish-price"
                  >¥{{ Number(dish.price || 0).toFixed(2)
                  }}{{ priceUnitSuffix(dish.priceUnit) }}</text
                >
                <text
                  v-for="notice in priceChanges(dish.id)"
                  :key="notice.kind"
                  class="planning-price-change"
                  >{{ notice.unitChanged ? t('social.pricingUpdatedPrefix') : ''
                  }}{{ t('social.previousPricePrefix') }}
                  {{ mealPlanPreviousPriceLabel(notice) }}</text
                >
              </view>
              <text
                v-if="typeof dish.averageRating === 'number'"
                class="planning-dish-rating"
                :class="{ 'planning-dish-rating-rated': dish.averageRating > 0 }"
                >{{
                  dish.averageRating === 0
                    ? t('social.noRating')
                    : t('social.dishRatingValue', { p0: dish.averageRating.toFixed(1) })
                }}</text
              >
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
        <text
          v-for="notice in generalNotices"
          :key="notice.kind"
          class="planning-dish-supply"
          role="status"
          >{{ mealPlanNoticeMessage(notice) }}</text
        >
        <text class="planning-price-total"
          >{{ t('social.listedPriceTotalColon') }}{{ totalPrice.toFixed(2) }}</text
        >
        <view class="planning-card-actions">
          <button
            class="planning-card-apply"
            hover-class="planning-control-pressed"
            :hover-stay-time="80"
            role="button"
            :tabindex="plan.appliedStatus === 'success' ? -1 : 0"
            :aria-disabled="plan.appliedStatus === 'success'"
            :class="{ 'is-disabled': plan.appliedStatus === 'success' }"
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
import { t } from '@/i18n';
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import type { ComponentMealPlanDraft, Dish, MealPlanChangeNotice } from '@/types/api';
import DishNutrition from '@/components/DishNutrition.vue';
import TagBadge from '@/components/TagBadge.vue';
import { priceUnitSuffix } from '@/utils/price-display';
import {
  mealPlanDishNotices,
  mealPlanNoticeMessage,
  mealPlanPreviousPriceLabel,
} from '@/utils/meal-plan-changes';

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
  if (props.plan.appliedStatus === 'success') return t('social.added');
  if (props.plan.appliedStatus === 'failed') return t('social.addFailedRetry');
  return t('social.addToPlans');
});

const preview = computed(() => props.plan.previewData);

const priceChanges = (dishId: string) =>
  (props.plan.changeNotices || []).filter(
    (notice): notice is Extract<MealPlanChangeNotice, { kind: 'price' }> =>
      notice.kind === 'price' && notice.dishId === dishId
  );
const generalNotices = computed(() =>
  (props.plan.changeNotices || []).filter(notice => !notice.dishId)
);
const dishStatusLabel = (dish: Dish) => {
  if (dish.status === 'offline') return t('social.unavailable');
  const notice = props.plan.changeNotices?.find(
    item => item.kind === 'status' && item.dishId === dish.id
  );
  return notice ? mealPlanNoticeMessage(notice) : '';
};
const dishSupplyNotices = (dish: Dish) => [
  ...new Set([
    ...mealPlanDishNotices(dish, preview.value),
    ...(props.plan.changeNotices || [])
      .filter(notice => notice.kind === 'supply' && notice.dishId === dish.id)
      .map(notice => mealPlanNoticeMessage(notice)),
  ]),
];
const changeSummary = computed(() => {
  const names = new Map((preview.value?.dishes || []).map(dish => [dish.id, dish.name]));
  const groups = new Map<string, string[]>();
  for (const notice of props.plan.changeNotices || []) {
    const name = notice.dishId ? names.get(notice.dishId) || '' : '';
    const messages = groups.get(name) || [];
    messages.push(mealPlanNoticeMessage(notice));
    groups.set(name, messages);
  }
  return Array.from(
    groups,
    ([name, messages]) =>
      `${name ? name + t('social.noticeNameSeparator') : ''}${messages.join(t('social.noticeSeparator'))}`
  ).join(t('social.groupSeparator'));
});

const mealTimeMap: Record<string, string> = {
  breakfast: 'social.breakfast',
  lunch: 'social.lunch',
  dinner: 'social.dinner',
  nightsnack: 'social.lateNight',
};

const dateText = computed(() => {
  const p = preview.value;
  if (!p?.startDate) return t('social.mealPlanSuggestion');
  const startText = dayjs(p.startDate).format(t('social.shortDateFormat'));
  const dateText =
    p.endDate && p.endDate !== p.startDate
      ? `${startText} — ${dayjs(p.endDate).format(t('social.shortDateFormat'))}`
      : startText;
  return dateText;
});
const mealText = computed(() =>
  preview.value ? t(mealTimeMap[preview.value.mealTime] || 'social.meal') : ''
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
.planning-change-summary {
  display: block;
  margin-top: 10px;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.planning-dish-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.planning-dish-price-group {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.planning-price-change,
.planning-dish-supply {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}
.planning-dish-supply {
  display: block;
  margin-top: 4px;
}
.planning-summary {
  display: block;
  margin-bottom: 12px;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.65;
}
.planning-card-date {
  display: block;
  color: #667085;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
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
.planning-dish-name {
  display: block;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}
.planning-dish-location {
  display: block;
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
.planning-dish-details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 8px;
  line-height: 1.5;
}
.planning-dish-price {
  color: var(--color-price, #2f6b50);
  font-size: 14px;
  font-weight: 600;
}
.planning-dish-rating {
  color: #667085;
  font-size: 13px;
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
.planning-card-apply.is-disabled {
  color: #667085;
  background: #f7f8fa;
}
.planning-card-apply:not(.is-disabled):active {
  opacity: 0.8;
}
.planning-card-apply.planning-control-pressed:not(.is-disabled) {
  background: #50065b;
}
.planning-card-toggle.planning-control-pressed {
  background: #f4f4f5;
}
@media (hover: hover) {
  .planning-card-apply:not(.is-disabled):hover {
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
