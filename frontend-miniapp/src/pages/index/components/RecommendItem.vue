<!-- @/components/RecommendItem.vue -->
<template>
  <div class="dish-card" :data-allergen="dish.allergens?.join(',') || '无'">
    <img :src="dish.images[0] || '/default-dish.png'" :alt="dish.name" class="w-20 h-20 rounded-lg mr-3" style="object-fit:cover" />
    <div class="flex-grow">
      <h3 class="font-medium">{{ dish.name }}</h3>
      <p class="text-sm text-gray-500 mt-1">{{ dish.canteenName }} {{ dish.floor || '' }}-{{ dish.windowName }}</p>
      <div class="flex justify-between items-center mt-2">
        <span class="text-price font-bold">¥{{ dish.price.toFixed(1) }}</span>
        <div class="flex items-center">
          <span class="iconify text-rating" data-icon="mdi:star" data-width="16"></span>
          <span class="text-rating ml-1">{{ dish.averageRating.toFixed(1) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Dish } from '@/types/api';

defineProps<{
  dish: Dish;
}>();
</script>

<style scoped>
.dish-card {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.text-price { color: #FF6B35; }
.text-rating { color: #FFA726; }
</style>