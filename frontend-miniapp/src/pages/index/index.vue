<template>
  <div class="min-h-screen bg-white rounded-lg overflow-hidden flex flex-col">
    <!-- 主内容区 -->
    <div class="flex-1 overflow-y-auto px-4 hide-scrollbar">
      <SearchBar @click="navigateTo('/pages/search/index')" />

      <!-- 食堂栏目 -->
      <div v-if="canteenStore.loading" class="text-center py-4 text-gray-500">正在加载食堂...</div>
      <div v-else-if="canteenStore.error" class="text-center py-4 text-red-500">{{ canteenStore.error }}</div>
      <div v-else class="flex overflow-x-auto pb-4 hide-scrollbar">
        <!-- 修正: 直接访问 canteenStore.canteenList -->
        <CanteenItem
          v-for="canteen in canteenStore.canteenList"
          :key="canteen.id"
          :canteen="canteen"
          @click="navigateTo(`/pages/canteen/detail?id=${canteen.id}`)"
        />
      </div>

      <FilterBar />

      <!-- 菜品列表 -->
      <div class="text-lg font-semibold text-gray-800 my-4">今日推荐</div>
      <div v-if="dishesStore.loading" class="text-center py-4 text-gray-500">正在加载推荐菜品...</div>
      <div v-else-if="dishesStore.error" class="text-center py-4 text-red-500">{{ dishesStore.error }}</div>
      <div v-else-if="topThreeDishes.length > 0">
        <RecommendItem
          v-for="dish in topThreeDishes"
          :key="dish.id"
          :dish="dish"
          @click="navigateTo(`/pages/canteen/dish-detail?id=${dish.id}`)"
        />
      </div>
      <div v-else class="text-center py-10 text-gray-500">
        今天好像没有推荐菜品哦
      </div>
    </div>

    <!-- 底部导航栏 -->
    <div class="h-20 bg-white flex border-t border-gray-200 flex-shrink-0">
      <!-- ... (这部分保持不变) ... -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
// import { storeToRefs } from 'pinia'; // <-- 1. 不再需要 storeToRefs

// ... 导入子组件 (保持不变) ...
import SearchBar from './components/SearchBar.vue';
import CanteenItem from './components/CanteenList.vue';
import RecommendItem from './components/RecommendItem.vue';
import FilterBar from './components/FilterBar.vue';

// 导入 Store
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import type { GetDishesRequest } from '@/types/api';


// --- 底部导航数据 (保持不变) ---
const navItems = [ /* ... */ ];

// --- Store 实例化 (核心修改点) ---
// 2. 直接获取 store 实例
const canteenStore = useCanteenStore();
const dishesStore = useDishesStore();

// --- 计算属性 ---
// 3. 计算属性直接从 store 实例中读取 state
const topThreeDishes = computed(() => {
  return dishesStore.dishes.slice(0, 3);
});


// --- 页面导航逻辑 (保持不变) ---
function handleTabSwitch(item: { path: string }) { /* ... */ }
function navigateTo(path: string) { /* ... */ }

// --- 生命周期 ---
onMounted(() => {
  // 4. 调用 actions (保持不变)
  canteenStore.fetchCanteenList({ page: 1, pageSize: 10 });

  const dishRequestParams: GetDishesRequest = {
    sort: { field: 'averageRating', order: 'desc' },
    pagination: { page: 1, pageSize: 10 },
    filter: {},
    search: { keyword: '' },
  };
  dishesStore.fetchDishes(dishRequestParams);
});
</script>


<style scoped>
/* 仅保留在小程序与浏览器中隐藏滚动条的必要样式 */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* 兼容旧类名的最小 CSS（使用普通 CSS 避免 @apply 编译问题） */
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9CA3AF; /* text-gray-400 */
  cursor: pointer;
}
.nav-item.active { color: #6B21A8; } /* text-purple-600 */
.nav-icon { font-size: 1.25rem; margin-bottom: 0.25rem; } /* text-xl mb-1 */
.nav-text { font-size: 0.6875rem; } /* text-xs */
</style>