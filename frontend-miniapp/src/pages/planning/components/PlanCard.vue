<template>
  <view class="meal-card" @tap="emit('view')">
    <view class="meal-card-heading" :class="{ 'meal-card-heading-compact': !showSchedule }"
      ><view v-if="showSchedule" class="meal-card-title"
        ><text>{{ dateText }}</text
        ><text class="meal-card-time">{{ mealTimeText }}</text></view
      ><view class="meal-card-tools"
        ><!-- #ifndef MP-WEIXIN -->
        <IconButton
          v-if="canPublish || plan.isPublic"
          :name="plan.isPublic ? 'eye' : 'eye-off'"
          :label="plan.isPublic ? t('social.makePrivate') : t('social.makePlanPublic')"
          :title="plan.isPublic ? t('social.makePrivate') : t('social.makePlanPublic')"
          :tone="plan.isPublic ? 'primary' : 'muted'"
          :pressed="!!plan.isPublic"
          @click="emit('privacy')" />
        <!-- #endif -->
        <IconButton
          v-if="!isHistory"
          name="edit"
          :label="t('social.editPlan')"
          :title="t('social.editPlan')"
          :disabled="!plan.dishesReady"
          @click="emit('edit')" /><IconButton
          name="trash"
          :label="t('social.deletePlan')"
          :title="t('social.deletePlan')"
          @click="emit('delete')" /></view
    ></view>
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
        ><view class="meal-card-name-row"
          ><text class="meal-card-name">{{ localizedDishName(dish) }}</text
          ><TagBadge
            v-if="dish.status === 'offline'"
            :label="t('social.unavailable')"
            tone="neutral" /></view
        ><text class="meal-card-location"
          >{{ dish.canteenName || t('social.canteenUnavailable')
          }}{{ dish.windowName ? ' / ' + dish.windowName : '' }}</text
        ><text
          v-for="notice in mealPlanDishNotices(dish, plan)"
          :key="notice"
          class="meal-card-supply"
          >{{ notice }}</text
        ><DishNutrition :dish="dish" /><view class="meal-card-meta"
          ><text class="meal-card-price"
            >¥{{ dish.price }}{{ priceUnitSuffix(dish.priceUnit) }}</text
          ><text
            class="meal-card-rating"
            :class="{ 'meal-card-rating-rated': dish.averageRating > 0 }"
            >{{
              dish.averageRating
                ? t('social.ratingValue', { p0: dish.averageRating.toFixed(1) })
                : t('social.noRating')
            }}</text
          ></view
        ></view
      >
    </view>
    <view class="meal-card-footer"
      ><text v-if="plan.dishesReady" class="meal-card-total"
        >{{ t('social.unitPriceTotal') }}{{ totalPrice.toFixed(2) }}</text
      ><text v-else class="meal-card-status">{{ t('social.dishDetailsIncomplete') }}</text
      ><button
        v-if="!isHistory || occurrenceDate"
        class="meal-card-button meal-card-complete"
        :disabled="!plan.isCompleted && actionDate > today"
        @tap.stop="emit('execute')"
      >
        {{
          plan.isCompleted
            ? t('social.undoEaten')
            : actionDate > today
              ? t('social.mealDateNotReached')
              : occurrenceDate
                ? t('social.markDateEaten')
                : t('social.markEaten')
        }}</button
      ><text v-else class="meal-card-status">{{
        plan.isCompleted ? t('social.markedEaten') : t('social.notMarkedEaten')
      }}</text></view
    >
    <!-- #ifndef MP-WEIXIN -->
    <view v-if="canPublish && !plan.isExpired" class="meal-card-sharing" @tap.stop>
      <button class="meal-card-button meal-card-invite" @click="emit('invite')">
        <UiIcon name="users" :size="18" />{{ t('social.createInvite') }}
      </button>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { localizedDishName } from '@/utils/dish-localization';
import { t } from '@/i18n';
import { computed, ref } from 'vue';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import dayjs from 'dayjs';
import UiIcon from '@/components/UiIcon.vue';
import IconButton from '@/components/IconButton.vue';
import { campusToday, coversDate, planDateKey } from '../utils/meal-plan-date';
import DishNutrition from '@/components/DishNutrition.vue';
import TagBadge from '@/components/TagBadge.vue';
import { priceUnitSuffix } from '@/utils/price-display';
import { mealPlanDishNotices } from '@/utils/meal-plan-changes';

const props = withDefaults(
  defineProps<{
    plan: EnrichedMealPlan;
    isHistory?: boolean;
    occurrenceDate?: string;
    canPublish?: boolean;
    today?: string;
    showSchedule?: boolean;
  }>(),
  { today: () => campusToday(), showSchedule: true }
);
const actionDate = computed(
  () =>
    props.occurrenceDate ||
    (coversDate(props.plan, props.today) ? props.today : planDateKey(props.plan.startDate))
);
const emit = defineEmits<{
  (e: 'view'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'execute'): void;
  (e: 'privacy'): void;
  (e: 'invite'): void;
}>();
const failedImages = ref<Record<string, boolean>>({});
const mealTimeMap = {
  breakfast: 'social.breakfast',
  lunch: 'social.lunch',
  dinner: 'social.dinner',
  nightsnack: 'social.lateNight',
};
const mealTimeText = computed(() => t(mealTimeMap[props.plan.mealTime] || 'social.meal'));
const totalPrice = computed(() => props.plan.dishes.reduce((sum, dish) => sum + dish.price, 0));
const dateText = computed(() => {
  const start = dayjs(props.plan.startDate).format(t('social.shortDateFormat'));
  return dayjs(props.plan.startDate).isSame(props.plan.endDate, 'day')
    ? start
    : start + ' — ' + dayjs(props.plan.endDate).format(t('social.shortDateFormat'));
});
</script>

<style scoped>
.meal-card-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.meal-card-supply {
  display: block;
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}
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
.meal-card-sharing {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
.meal-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 12px;
}
.meal-card-heading-compact {
  justify-content: flex-end;
  padding-bottom: 4px;
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
.meal-card-invite {
  display: flex;
  align-items: center;
  gap: 6px;
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
