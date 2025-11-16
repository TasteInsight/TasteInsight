import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Dish } from '@/types/api';

export const useDishStore = defineStore('dish', () => {
  const dishes = ref<Dish[]>([]);
  const currentDish = ref<Dish | null>(null);
  const searchQuery = ref<string>('');
  const filterOptions = ref<{ canteenId: string; status: string }>({
    canteenId: '',
    status: ''
  });

  const filteredDishes = computed(() => {
    let filtered = dishes.value;

    if (searchQuery.value) {
      filtered = filtered.filter(dish =>
        dish.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        dish.canteenId.toLowerCase().includes(searchQuery.value.toLowerCase())
      );
    }

    if (filterOptions.value.canteenId) {
      filtered = filtered.filter(dish => dish.canteenId === filterOptions.value.canteenId);
    }

    if (filterOptions.value.status) {
      filtered = filtered.filter(dish => dish.status === filterOptions.value.status);
    }

    return filtered;
  });

  const setSearchQuery = (query: string) => {
    searchQuery.value = query;
  };

  const setFilterOptions = (options: Partial<{ canteenId: string; status: string }>) => {
    filterOptions.value = { ...filterOptions.value, ...options };
  };

  return {
    dishes,
    currentDish,
    searchQuery,
    filterOptions,
    filteredDishes,
    setSearchQuery,
    setFilterOptions
  };
});