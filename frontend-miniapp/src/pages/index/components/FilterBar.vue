<!-- @/components/FilterBar.vue -->
<template>
  <div class="py-3">
    <div class="flex flex-wrap">
      <div
        v-for="filter in filters"
        :key="filter.key"
        class="inline-flex items-center bg-white border rounded-full h-8 px-3 text-sm mr-2 cursor-pointer"
        :class="{ 'border-purple-600 bg-purple-100': filter.active, 'border-gray-300': !filter.active }"
        @click="toggleFilter(filter.key)"
      >
        <span>{{ filter.label }}</span>
        <span v-if="filter.active" class="ml-1">×</span>
      </div>
    </div>
    <!-- 展开的选择选项 -->
    <div v-if="activeFilter" class="mt-2 flex flex-wrap gap-2">
      <div
        v-for="option in activeFilter.options"
        :key="option"
        class="inline-flex items-center bg-gray-100 border border-gray-300 rounded-full h-6 px-2 text-xs cursor-pointer"
        :class="{ 'bg-purple-200 border-purple-600': selectedOptions.includes(option) }"
        @click="toggleOption(option)"
      >
        <span>{{ option }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  filterChange: [filters: Record<string, string[]>];
}>();

const filters = ref([
  { key: 'taste', label: '口味', active: false, options: ['川菜', '粤菜', '湘菜', '素菜', '其他'] },
  { key: 'price', label: '价格', active: false, options: ['低价(<10)', '中价(10-15)', '高价(>15)'] },
  { key: 'rating', label: '评分', active: false, options: ['4.0+', '4.5+', '4.8+'] },
  { key: 'meat', label: '荤素', active: false, options: ['荤菜', '素菜'] },
  { key: 'allergen', label: '过敏原', active: false, options: ['鸡肉', '猪肉', '牛肉', '海鲜', '无'] },
]);

const activeFilter = ref<{ key: string; label: string; active: boolean; options: string[] } | null>(null);
const selectedOptions = ref<string[]>([]);

const toggleFilter = (key: string) => {
  const filter = filters.value.find(f => f.key === key);
  if (!filter) return;

  if (filter.active) {
    // 关闭筛选
    filter.active = false;
    activeFilter.value = null;
    selectedOptions.value = [];
    emitFilterChange();
  } else {
    // 打开筛选，关闭其他
    filters.value.forEach(f => f.active = false);
    filter.active = true;
    activeFilter.value = filter;
    selectedOptions.value = [];
  }
};

const toggleOption = (option: string) => {
  const index = selectedOptions.value.indexOf(option);
  if (index > -1) {
    selectedOptions.value.splice(index, 1);
  } else {
    selectedOptions.value.push(option);
  }
  emitFilterChange();
};

const emitFilterChange = () => {
  const filterMap: Record<string, string[]> = {};
  filters.value.forEach(filter => {
    if (filter.active && selectedOptions.value.length > 0) {
      filterMap[filter.key] = selectedOptions.value;
    }
  });
  emit('filterChange', filterMap);
};
</script>

