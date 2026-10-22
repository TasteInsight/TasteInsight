<!-- @/pages/window/components/WindowFilterBar.vue -->
<template>
  <view class="filter-bar">
    <!-- 筛选标签栏 -->
    <view class="flex flex-wrap py-3 gap-2">
      <view
        v-for="filter in filterOptions"
        :key="filter.key"
        class="inline-flex items-center border rounded-full h-8 px-3 text-sm cursor-pointer transition-all"
        :class="
          activeFilter === filter.key || hasActiveValue(filter.key)
            ? 'bg-ts-purple text-white border-ts-purple'
            : 'bg-white text-gray-700 border-gray-300'
        "
        @click="toggleFilter(filter.key)"
      >
        <text>{{ filter.label }}</text>
        <text v-if="hasActiveValue(filter.key)" class="ml-1 text-xs">✓</text>
      </view>
    </view>

    <!-- 筛选面板 -->
    <view v-if="activeFilter" class="filter-panel bg-white rounded-lg shadow-lg p-4 mb-4">
      <!-- 价格筛选 -->
      <view v-if="activeFilter === 'price'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">{{ t('food.priceRange') }}</view>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="option in priceOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="
              selectedPrice === option.value
                ? 'bg-ts-purple text-white border-ts-purple'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            "
            @click="selectPrice(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <!-- 评分筛选 -->
      <view v-if="activeFilter === 'rating'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">{{ t('food.minimumRating') }}</view>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="option in ratingOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="
              selectedRating === option.value
                ? 'bg-ts-purple text-white border-ts-purple'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            "
            @click="selectRating(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <!-- 荤素筛选 -->
      <view v-if="activeFilter === 'meat'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">{{ t('food.meatPreference') }}</view>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="option in meatOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="
              selectedMeat.includes(option.value)
                ? 'bg-ts-purple text-white border-ts-purple'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            "
            @click="toggleMeat(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <!-- 口味筛选 -->
      <view v-if="activeFilter === 'taste'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">{{ t('food.tastePreference') }}</view>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="option in tasteOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="
              selectedTastes.includes(option.value)
                ? 'bg-ts-purple text-white border-ts-purple'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            "
            @click="toggleTaste(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <!-- 用餐时段筛选 -->
      <view v-if="activeFilter === 'mealTime'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">{{ t('food.mealTimes') }}</view>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="option in mealTimeOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="
              selectedMealTime.includes(option.value)
                ? 'bg-ts-purple text-white border-ts-purple'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            "
            @click="toggleMealTime(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
        <view
          class="px-4 py-1.5 rounded-full text-sm cursor-pointer bg-gray-100 text-gray-600"
          @click="resetCurrentFilter"
        >
          {{ t('food.reset') }}
        </view>
        <view
          class="px-4 py-1.5 rounded-full text-sm cursor-pointer bg-ts-purple text-white"
          @click="applyFilter"
        >
          {{ t('food.apply') }}
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { ref, computed } from 'vue';
import type { GetDishesRequest } from '@/types/api';

// 定义事件
const emit = defineEmits<{
  (e: 'filter-change', filter: GetDishesRequest['filter']): void;
}>();

// 筛选选项配置
const filterOptions = [
  {
    key: 'taste',
    get label() {
      return t('food.taste');
    },
  },
  {
    key: 'price',
    get label() {
      return t('food.price');
    },
  },
  {
    key: 'rating',
    get label() {
      return t('food.rating');
    },
  },
  {
    key: 'meat',
    get label() {
      return t('food.meat');
    },
  },
  {
    key: 'mealTime',
    get label() {
      return t('food.time');
    },
  },
];

// 价格选项
const priceOptions = [
  {
    get label() {
      return t('food.any');
    },
    value: '',
  },
  {
    get label() {
      return t('food.under10');
    },
    value: '0-10',
  },
  {
    get label() {
      return t('food.1015');
    },
    value: '10-15',
  },
  {
    get label() {
      return t('food.1520');
    },
    value: '15-20',
  },
  {
    get label() {
      return t('food.over20');
    },
    value: '20-999',
  },
];

// 评分选项
const ratingOptions = [
  {
    get label() {
      return t('food.any');
    },
    value: 0,
  },
  {
    get label() {
      return t('food.45OrHigher');
    },
    value: 4.5,
  },
  {
    get label() {
      return t('food.40OrHigher');
    },
    value: 4.0,
  },
  {
    get label() {
      return t('food.35OrHigher');
    },
    value: 3.5,
  },
];

// 荤素选项
const meatOptions = [
  {
    get label() {
      return t('food.meatDishes');
    },
    value: '荤',
  },
  {
    get label() {
      return t('food.vegetarianDishes');
    },
    value: '素',
  },
  {
    get label() {
      return t('food.meatAndVegetables');
    },
    value: '荤素',
  },
];

// 口味选项
const tasteOptions = [
  {
    get label() {
      return t('food.spicy2');
    },
    value: '辣',
  },
  {
    get label() {
      return t('food.light');
    },
    value: '清淡',
  },
  {
    get label() {
      return t('food.sweetAndSour');
    },
    value: '酸甜',
  },
  {
    get label() {
      return t('food.savory');
    },
    value: '咸鲜',
  },
  {
    get label() {
      return t('food.numbingAndSpicy');
    },
    value: '麻辣',
  },
];

// 用餐时段选项
const mealTimeOptions = [
  {
    get label() {
      return t('food.breakfast');
    },
    value: 'breakfast',
  },
  {
    get label() {
      return t('food.lunch');
    },
    value: 'lunch',
  },
  {
    get label() {
      return t('food.dinner');
    },
    value: 'dinner',
  },
];

// 当前展开的筛选项
const activeFilter = ref<string>('');

// 各筛选项的选中状态
const selectedPrice = ref<string>('');
const selectedRating = ref<number>(0);
const selectedMeat = ref<string[]>([]);
const selectedTastes = ref<string[]>([]);
const selectedMealTime = ref<string[]>([]);

// 检查某个筛选项是否有值
const hasActiveValue = (key: string): boolean => {
  switch (key) {
    case 'price':
      return selectedPrice.value !== '';
    case 'rating':
      return selectedRating.value > 0;
    case 'meat':
      return selectedMeat.value.length > 0;
    case 'taste':
      return selectedTastes.value.length > 0;
    case 'mealTime':
      return selectedMealTime.value.length > 0;
    default:
      return false;
  }
};

// 切换筛选面板
const toggleFilter = (key: string) => {
  activeFilter.value = activeFilter.value === key ? '' : key;
};

// 选择价格
const selectPrice = (value: string) => {
  selectedPrice.value = selectedPrice.value === value ? '' : value;
};

// 选择评分
const selectRating = (value: number) => {
  selectedRating.value = selectedRating.value === value ? 0 : value;
};

// 切换荤素
const toggleMeat = (value: string) => {
  const index = selectedMeat.value.indexOf(value);
  if (index === -1) {
    selectedMeat.value.push(value);
  } else {
    selectedMeat.value.splice(index, 1);
  }
};

// 切换口味
const toggleTaste = (value: string) => {
  const index = selectedTastes.value.indexOf(value);
  if (index === -1) {
    selectedTastes.value.push(value);
  } else {
    selectedTastes.value.splice(index, 1);
  }
};

// 切换用餐时段
const toggleMealTime = (value: string) => {
  const index = selectedMealTime.value.indexOf(value);
  if (index === -1) {
    selectedMealTime.value.push(value);
  } else {
    selectedMealTime.value.splice(index, 1);
  }
};

// 重置当前筛选项
const resetCurrentFilter = () => {
  switch (activeFilter.value) {
    case 'price':
      selectedPrice.value = '';
      break;
    case 'rating':
      selectedRating.value = 0;
      break;
    case 'meat':
      selectedMeat.value = [];
      break;
    case 'taste':
      selectedTastes.value = [];
      break;
    case 'mealTime':
      selectedMealTime.value = [];
      break;
  }
};

// 构建并应用筛选条件
const applyFilter = () => {
  const filter: GetDishesRequest['filter'] = {};

  // 价格筛选
  if (selectedPrice.value) {
    const [min, max] = selectedPrice.value.split('-').map(Number);
    filter.price = { min, max };
  }

  // 评分筛选
  if (selectedRating.value > 0) {
    filter.rating = { min: selectedRating.value, max: 5 };
  }

  // 荤素筛选（通过 tag 实现）
  if (selectedMeat.value.length > 0) {
    filter.meatPreference = selectedMeat.value;
  }

  // 口味筛选（通过 tag 实现）
  if (selectedTastes.value.length > 0) {
    filter.tag = selectedTastes.value;
  }

  // 用餐时段筛选
  if (selectedMealTime.value.length > 0) {
    filter.mealTime = selectedMealTime.value;
  }

  // 关闭面板并触发事件
  activeFilter.value = '';
  emit('filter-change', filter);
};

// 暴露重置方法供父组件调用
const resetAllFilters = () => {
  selectedPrice.value = '';
  selectedRating.value = 0;
  selectedMeat.value = [];
  selectedTastes.value = [];
  selectedMealTime.value = [];
  activeFilter.value = '';
  emit('filter-change', {});
};

defineExpose({
  resetAllFilters,
});
</script>

<style scoped>
.filter-bar {
  position: relative;
}

.filter-panel {
  position: relative;
  z-index: 10;
  border: 1px solid #e5e7eb;
}
</style>
