<template>
  <DishSummaryCard :dish="dish" @select="emit('click', $event)" />
</template>

<script setup lang="ts">
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import type { Dish } from '@/types/api';

defineProps<{ dish: Dish }>();
const emit = defineEmits<{ (e: 'click', dishId: string): void }>();
</script>
