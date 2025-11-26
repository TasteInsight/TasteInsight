<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 搜索栏 -->
    <div class="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
      <div class="flex items-center gap-2">
        <div class="flex-1 bg-gray-100 rounded-2xl h-10 flex items-center px-4">
          <text class="iconify" data-icon="mdi:magnify" style="color:#999; margin-right:8px;"></text>
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索食堂或菜品"
            class="flex-1 bg-transparent outline-none text-sm"
            @confirm="handleSearch"
          />
        </div>
        <button 
          class="text-blue-500 text-sm px-2"
          @click="handleSearch"
        >
          搜索
        </button>
        <button 
          class="text-gray-500 text-sm px-2"
          @click="navigateBack"
        >
          取消
        </button>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div class="px-4 py-3">
      <!-- 加载中 -->
      <div v-if="loading" class="text-center py-10 text-gray-500">
        正在搜索...
      </div>

      <!-- 错误提示 -->
      <div v-else-if="error" class="text-center py-10 text-red-500">
        {{ error }}
      </div>

      <!-- 无结果 -->
      <div v-else-if="!loading && searchResults.length === 0 && hasSearched" class="text-center py-10 text-gray-400">
        <text class="iconify text-4xl mb-2" data-icon="mdi:magnify"></text>
        <div>未找到相关结果</div>
        <div class="text-sm mt-1">试试搜索其他关键词</div>
      </div>

      <!-- 搜索结果 -->
      <div v-else-if="searchResults.length > 0">
        <!-- 食堂结果 -->
        <div v-if="canteenResults.length > 0" class="mb-6">
          <div class="text-sm font-semibold text-gray-600 mb-3">食堂 ({{ canteenResults.length }})</div>
          <CanteenResultItem 
            v-for="canteen in canteenResults" 
            :key="canteen.id"
            :canteen="canteen"
          />
        </div>

        <!-- 菜品结果 -->
        <div v-if="dishResults.length > 0">
          <div class="text-sm font-semibold text-gray-600 mb-3">菜品 ({{ dishResults.length }})</div>
          <DishResultItem 
            v-for="dish in dishResults" 
            :key="dish.id"
            :dish="dish"
          />
        </div>
      </div>

      <!-- 默认提示 -->
      <div v-else class="text-center py-10 text-gray-400">
        <text class="iconify text-4xl mb-2" data-icon="mdi:food"></text>
        <div class="text-sm">输入关键词搜索食堂或菜品</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSearch } from './composables/use-search';
import type { Canteen, Dish } from '@/types/api';
import CanteenResultItem from './components/CanteenResultItem.vue';
import DishResultItem from './components/DishResultItem.vue';

const { 
  keyword, 
  searchResults, 
  loading, 
  error, 
  hasSearched,
  search 
} = useSearch();

// 分类搜索结果
const canteenResults = computed(() => {
  return searchResults.value.filter((item: Canteen | Dish) => 'windows' in item) as Canteen[];
});

const dishResults = computed(() => {
  return searchResults.value.filter((item: Canteen | Dish) => 'canteenId' in item && !('windows' in item)) as Dish[];
});

// 执行搜索
const handleSearch = () => {
  if (keyword.value.trim()) {
    search();
  }
};

// 导航
const navigateBack = () => {
  uni.navigateBack();
};
</script>

<style scoped>
input {
  border: none;
  outline: none;
}
</style>
