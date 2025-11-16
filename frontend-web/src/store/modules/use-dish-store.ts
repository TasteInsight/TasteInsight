import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useDishStore = defineStore('dish', () => {
  const dishes = ref<any[]>([]);
  const currentDish = ref<any | null>(null);
  const searchQuery = ref<string>('');
  const filterOptions = ref<{ canteen: string; status: string }>({
    canteen: '',
    status: ''
  });

  const filteredDishes = computed(() => {
    let filtered = dishes.value;

    if (searchQuery.value) {
      filtered = filtered.filter(dish =>
        dish.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        dish.canteen.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        dish.window.toLowerCase().includes(searchQuery.value.toLowerCase())
      );
    }

    if (filterOptions.value.canteen) {
      filtered = filtered.filter(dish => dish.canteen === filterOptions.value.canteen);
    }

    if (filterOptions.value.status) {
      filtered = filtered.filter(dish => dish.status === filterOptions.value.status);
    }

    return filtered;
  });

  const setSearchQuery = (query: string) => {
    searchQuery.value = query;
  };

  const setFilterOptions = (options: Partial<{ canteen: string; status: string }>) => {
    filterOptions.value = { ...filterOptions.value, ...options };
  };

  const addDish = (dish: any) => {
    dishes.value.push({
      id: Date.now(),
      ...dish
    });
  };

  const updateDish = (id: string | number, updatedDish: any) => {
    const index = dishes.value.findIndex(dish => dish.id === id);
    if (index !== -1) {
      dishes.value[index] = { ...dishes.value[index], ...updatedDish };
    }
  };

  const deleteDish = (id: string | number) => {
    dishes.value = dishes.value.filter(dish => dish.id !== id);
  };

  return {
    dishes,
    currentDish,
    searchQuery,
    filterOptions,
    filteredDishes,
    setSearchQuery,
    setFilterOptions,
    addDish,
    updateDish,
    deleteDish
  };
});