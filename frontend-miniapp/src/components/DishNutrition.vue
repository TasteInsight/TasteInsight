<template>
  <view v-if="items.length" class="dish-nutrition" aria-label="每份营养信息">
    <text class="dish-nutrition__unit">每份</text>
    <text v-for="item in items" :key="item.key"
      >{{ item.label }} {{ item.value }} {{ item.unit }}</text
    >
  </view>
</template>
<script setup lang="ts">
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
    { key: 'calories', label: '热量', unit: 'kcal', visible: settings?.showCalories ?? true },
    { key: 'protein', label: '蛋白质', unit: 'g', visible: settings?.showNutrition ?? false },
    {
      key: 'carbohydrate',
      label: '碳水化合物',
      unit: 'g',
      visible: settings?.showNutrition ?? false,
    },
    { key: 'fat', label: '脂肪', unit: 'g', visible: settings?.showNutrition ?? false },
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
