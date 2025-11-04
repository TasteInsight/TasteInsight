<!-- @/views/home/index.vue -->
<template>
  <div class="app-page">
    <!-- 主内容区 -->
    <div class="content-container">
      <SearchBar />

      <!-- 食堂栏目 -->
      <div v-if="canteenLoading" class="text-center py-4 text-gray-500">正在加载食堂...</div>
      <div v-else-if="canteenError" class="text-center py-4 text-red-500">{{ canteenError }}</div>
      <div v-else class="flex overflow-x-auto pb-4 hide-scrollbar">
        <CanteenItem
          v-for="canteen in canteens"
          :key="canteen.id"
          :canteen="canteen"
          @click="navigateToCanteen(canteen.id)"
        />
      </div>

      <FilterBar />

      <!-- 菜品列表 -->
      <div class="section-title">今日推荐</div>
      <div v-if="recommendLoading" class="text-center py-4 text-gray-500">正在加载推荐菜品...</div>
      
      <div v-else-if="recommendedDishes.length > 0">
        <RecommendItem
          v-for="dish in recommendedDishes"
          :key="dish.id"
          :dish="dish"
          @click="navigateToDish(dish.id)"
        />
      </div>
      <div v-else class="text-center py-10 text-gray-500">
        今天好像没有推荐菜品哦
      </div>
    </div>

    <!-- 底部导航栏 -->
    <div class="nav-bar">
      <div class="nav-item active">
        <span class="iconify nav-icon" data-icon="mdi:home"></span>
        <span class="nav-text">首页</span>
      </div>
      <div class="nav-item" data-role="news">
        <span class="iconify nav-icon" data-icon="mdi:newspaper"></span>
        <span class="nav-text">新闻</span>
      </div>
      <div class="nav-item" data-role="plan">
        <span class="iconify nav-icon" data-icon="mdi:calendar"></span>
        <span class="nav-text">规划</span>
      </div>
      <div class="nav-item" data-role="ai">
        <span class="iconify nav-icon" data-icon="mdi:robot"></span>
        <span class="nav-text">问AI</span>
      </div>
      <div class="nav-item" data-role="mine">
        <span class="iconify nav-icon" data-icon="mdi:account"></span>
        <span class="nav-text">我的</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router'; // 假设您使用 vue-router

// 导入子组件
import SearchBar from '@/pages/index/components/SearchBar.vue';
import CanteenItem from '@/pages/index/components/CanteenList.vue';
import FilterBar from '@/pages/index/components/FilterBar.vue';
import RecommendItem from '@/pages/index/components/RecommendItem.vue';

// 导入 API 和 Composable
import { getCanteenList } from '@/api/modules/canteen';
import { useRecommendDishes } from '@/pages/index/composables/use-recommend-dishes';
import type { Canteen } from '@/types/api';

const router = useRouter();

// --- 食堂数据 ---
const canteens = ref<Canteen[]>([]);
const canteenLoading = ref(false);
const canteenError = ref<string | null>(null);

async function fetchCanteens() {
  canteenLoading.value = true;
  canteenError.value = null;
  try {
    const res = await getCanteenList({ page: 1, pageSize: 10 });
    // 注意：根据您的 API 定义，CanteenListData 包装在 data 对象中
    if (res.data && res.data.items) {
      canteens.value = res.data.items;
    } else {
       throw new Error('返回的数据格式不正确');
    }
  } catch (error) {
    canteenError.value = error instanceof Error ? error.message : '加载食堂失败';
    console.error(canteenError.value, error);
  } finally {
    canteenLoading.value = false;
  }
}

// --- 推荐菜品数据 ---
const { 
  dishes: recommendedDishes, 
  loading: recommendLoading, 
  fetchDishes 
} = useRecommendDishes();

// --- 页面导航 ---
function navigateToCanteen(id: string) {
  router.push(`/canteen/${id}`);
}
function navigateToDish(id: string) {
  router.push(`/dish/${id}`);
}

// --- 生命周期 ---
onMounted(() => {
  fetchCanteens();
  fetchDishes();
});
</script>

<style scoped>
/* 复制 test.html 中的核心样式 */
.app-page {
  position: relative;
  width: 375px;
  height: 812px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.content-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 16px 0 12px;
}
.nav-bar {
  height: 80px;
  background: white;
  display: flex;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  cursor: pointer;
}
.nav-item.active {
  color: #82318E;
}
.nav-icon {
  font-size: 20px;
  margin-bottom: 4px;
}
.nav-text {
  font-size: 11px;
}
</style>