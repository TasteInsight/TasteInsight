<!-- @/pages/canteen/components/CanteenFilterBar.vue -->
<template>
  <FilterBar ref="filterBarRef" @filter-change="forwardFilterChange" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { GetDishesRequest } from '@/types/api';
import FilterBar from '@/pages/index/components/FilterBar.vue';

const emit = defineEmits<{
  (e: 'filter-change', filter: GetDishesRequest['filter']): void;
}>();

type FilterBarInstance = {
  resetAllFilters?: () => void;
};

const filterBarRef = ref<FilterBarInstance | null>(null);

const forwardFilterChange = (filter: GetDishesRequest['filter']) => {
  emit('filter-change', filter);
};

const resetAllFilters = () => {
  filterBarRef.value?.resetAllFilters?.();
};

defineExpose({
  resetAllFilters,
});
</script>

