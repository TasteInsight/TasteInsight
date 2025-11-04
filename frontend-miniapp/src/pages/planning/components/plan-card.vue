<template>
  <div class="card">
    <div class="purple-bg py-2 px-3 rounded-lg mb-3">
      <div class="font-bold text-white">{{ formatDate(plan.startDate) }} | {{ mealTimeText }}</div>
    </div>

    <div v-for="dish in plan.dishes" :key="dish.id" class="flex mb-3">
      <img :src="dish.images[0] || '/default-dish.png'" class="w-20 h-20 rounded-lg" style="object-fit:cover" />
      <div class="ml-3 flex-grow">
        <h3 class="font-medium">{{ dish.name }}</h3>
        <p class="text-sm text-gray-500 mt-1">{{ dish.canteenName }}</p>
        <div class="flex justify-between items-center mt-2">
          <span class="text-price font-bold">¥{{ dish.price }}</span>
          <div class="flex items-center">
            <span class="iconify text-rating" data-icon="mdi:star" data-width="16"></span>
            <span class="text-rating ml-1">{{ dish.averageRating.toFixed(1) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
      <span class="text-gray-600">总价：¥{{ totalPrice.toFixed(1) }}</span>
      <button v-if="!isHistory" class="purple-bg text-white py-2 px-6 rounded-full">执行</button>
      <span v-else class="text-gray-500 text-sm">已完成</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EnrichedMealPlan } from '../composables/use-menu-planning';
import dayjs from 'dayjs';

const props = defineProps<{
  plan: EnrichedMealPlan;
  isHistory?: boolean;
}>();

const mealTimeMap = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  nightsnack: '夜宵'
};

const mealTimeText = computed(() => mealTimeMap[props.plan.mealTime] || '用餐');

const totalPrice = computed(() => 
  props.plan.dishes.reduce((sum, dish) => sum + dish.price, 0)
);

const formatDate = (date: string) => dayjs(date).format('MM月DD日');
</script>

<style scoped>
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 16px;
  margin-bottom: 12px;
}
.purple-bg { background: #82318E; }
.text-price { color: #FF6B35; }
.text-rating { color: #FFA726; }
</style>