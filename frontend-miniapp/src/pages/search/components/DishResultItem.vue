<template>
  <DishSummaryCard :dish="dish" @select="goToDetail" />
</template>

<script setup lang="ts">
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import type { Dish } from '@/types/api';

defineProps<{ dish: Dish }>();

const goToDetail = (id: string) => uni.navigateTo({ url: `/pages/dish/index?id=${id}` });
</script>
