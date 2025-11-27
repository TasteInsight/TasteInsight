<template>
  <div 
    class="bg-white rounded-lg p-4 mb-2 shadow-sm"
    @click="handleClick"
  >
    <div class="flex gap-3">
      <img 
        v-if="dish.images?.[0]" 
        :src="dish.images[0]" 
        class="w-20 h-20 rounded-lg object-cover"
      />
      <div v-else class="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
        <text class="iconify text-gray-400" data-icon="mdi:food"></text>
      </div>
      <div class="flex-1">
        <div class="font-semibold text-gray-800">{{ dish.name }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ dish.canteenName }} - {{ dish.windowName }}</div>
        <div class="flex items-center gap-2 mt-2">
          <div class="text-red-500 font-semibold">¥{{ dish.price }}</div>
          <div v-if="dish.averageRating" class="text-xs text-yellow-600">
            ⭐ {{ dish.averageRating.toFixed(1) }}
          </div>
        </div>
        <div v-if="dish.tags?.length" class="flex flex-wrap gap-1 mt-2">
          <span 
            v-for="tag in dish.tags.slice(0, 3)" 
            :key="tag"
            class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Dish } from '@/types/api';

interface Props {
  dish: Dish;
}

const props = defineProps<Props>();

const handleClick = () => {
  uni.navigateTo({
    url: `/pages/dish/index?id=${props.dish.id}`
  });
};
</script>
