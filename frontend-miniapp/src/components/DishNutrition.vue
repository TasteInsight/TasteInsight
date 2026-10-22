<template>
  <view v-if="items.length" class="dish-nutrition" :aria-label="t('common.nutrition.title')">
    <text class="dish-nutrition__unit">{{ t('common.nutrition.serving') }}</text>
    <text v-for="item in items" :key="item.key"
      >{{ item.label }} {{ item.value }} {{ item.unit }}</text
    >
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';

import { computed } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
const props = defineProps<{
  dish: {
    calories?: number | null;
    protein?: number | null;
    carbohydrate?: number | null;
    fat?: number | null;
  };
}>();
const userStore = useUserStore();
const items = computed(() => {
  const settings = userStore.isLoggedIn ? userStore.userInfo?.settings?.displaySettings : undefined;
  return [
    {
      key: 'calories',
      label: t('common.nutrition.calories'),
      unit: 'kcal',
      visible: settings?.showCalories ?? true,
    },
    {
      key: 'protein',
      label: t('common.nutrition.protein'),
      unit: 'g',
      visible: settings?.showNutrition ?? false,
    },
    {
      key: 'carbohydrate',
      label: t('common.nutrition.carbs'),
      unit: 'g',
      visible: settings?.showNutrition ?? false,
    },
    {
      key: 'fat',
      label: t('common.nutrition.fat'),
      unit: 'g',
      visible: settings?.showNutrition ?? false,
    },
  ]
    .map(item => ({ ...item, value: props.dish[item.key as keyof typeof props.dish] }))
    .filter(item => item.visible && item.value !== null && item.value !== undefined);
});
</script>
<style scoped>
.dish-nutrition {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.dish-nutrition__unit {
  font-weight: 600;
}
</style>
