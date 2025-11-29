<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 搜索栏 -->
    <div class="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
      <div class="flex items-center border border-purple-500 rounded-full p-0.5 bg-white">
        <uni-icons type="search" size="22" color="#999" class="ml-2"></uni-icons>
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索食堂、窗口或菜品"
          class="flex-1 bg-transparent outline-none text-sm px-2 h-9"
          @confirm="handleSearch"
        />
        <div 
          class="bg-purple-600 text-white text-sm px-6 h-9 flex items-center justify-center rounded-full ml-1 cursor-pointer"
          @click="handleSearch"
        >
          搜索
        </div>
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

      <!-- 无结果 - 显示添加菜品按钮 -->
      <div v-else-if="!loading && !hasResults && hasSearched" class="text-center py-10">
        <text class="iconify text-4xl mb-2 text-gray-300" data-icon="mdi:magnify"></text>
        <div class="text-gray-400">未找到"{{ keyword }}"相关结果</div>
        <div class="text-sm text-gray-400 mt-1">试试搜索其他关键词</div>
        
        <!-- 添加菜品按钮 -->
        <button 
          class="mt-6 px-6 py-3 bg-blue-500 text-white rounded-full flex items-center gap-2 mx-auto shadow-md"
          @click="goToAddDish"
        >
          <text class="iconify" data-icon="mdi:plus"></text>
          <span>添加新菜品</span>
        </button>
        <div class="text-xs text-gray-400 mt-2">找不到？帮我们添加这道菜吧</div>
      </div>

      <!-- 搜索结果 -->
      <div v-else-if="hasResults">
        <!-- 食堂结果 -->
        <div v-if="searchResults.canteens.length > 0" class="mb-6">
          <div class="text-sm font-semibold text-gray-600 mb-3">食堂 ({{ searchResults.canteens.length }})</div>
          <CanteenResultItem 
            v-for="canteen in searchResults.canteens" 
            :key="canteen.id"
            :canteen="canteen"
          />
        </div>

        <!-- 窗口结果 -->
        <div v-if="searchResults.windows.length > 0" class="mb-6">
          <div class="text-sm font-semibold text-gray-600 mb-3">窗口 ({{ searchResults.windows.length }})</div>
          <WindowResultItem 
            v-for="window in searchResults.windows" 
            :key="window.id"
            :window="window"
            :canteen-name="(window as any).canteenName"
          />
        </div>

        <!-- 菜品结果 -->
        <div v-if="searchResults.dishes.length > 0">
          <div class="text-sm font-semibold text-gray-600 mb-3">菜品 ({{ searchResults.dishes.length }})</div>
          <DishResultItem 
            v-for="dish in searchResults.dishes" 
            :key="dish.id"
            :dish="dish"
          />
        </div>
      </div>

      <!-- 默认提示 -->
      <div v-else class="text-center py-10 text-gray-400">
        <text class="iconify text-4xl mb-2" data-icon="mdi:food"></text>
        <div class="text-sm">输入关键词搜索食堂、窗口或菜品</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSearch } from './composables/use-search';
import CanteenResultItem from './components/CanteenResultItem.vue';
import WindowResultItem from './components/WindowResultItem.vue';
import DishResultItem from './components/DishResultItem.vue';

const { 
  keyword, 
  searchResults,
  hasResults,
  loading, 
  error, 
  hasSearched,
  search,
  goToAddDish,
} = useSearch();

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
