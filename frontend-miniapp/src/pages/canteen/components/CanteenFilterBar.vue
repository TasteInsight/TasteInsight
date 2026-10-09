<!-- @/pages/canteen/components/CanteenFilterBar.vue -->
<template>
  <FilterBar ref="filterBarRef" :filter="filter" @filter-change="forwardFilterChange" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GetDishesRequest } from '@/types/api';
import FilterBar from '@/pages/index/components/FilterBar.vue';

withDefaults(defineProps<{ filter?: GetDishesRequest['filter'] }>(), { filter: () => ({}) });

const emit = defineEmits<{
  (e: 'filter-change', filter: GetDishesRequest['filter']): void;
}>();

const filterBarRef = ref<InstanceType<typeof FilterBar> | null>(null);
const isOpen = computed(() => !!filterBarRef.value?.isOpen);
const closePanel = () => filterBarRef.value?.closePanel();

const forwardFilterChange = (filter: GetDishesRequest['filter']) => {
  emit('filter-change', filter);
};

const resetAllFilters = () => {
  filterBarRef.value?.resetAllFilters();
};

defineExpose({
  resetAllFilters,
  closePanel,
  isOpen,
});
</script>
