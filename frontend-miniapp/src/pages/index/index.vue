<template>
  <view class="min-h-screen bg-white rounded-lg overflow-hidden flex flex-col">
    <!-- 主内容区 -->
    <view class="flex-1 overflow-y-auto px-4 hide-scrollbar">
      <!-- 搜索栏 -->
      <SearchBar />

      <!-- 菜品图片轮播 -->
      <view  class="mb-4">
        <swiper
          class="dish-image-swiper"
          :indicator-dots="dishImages.length > 1"
          :autoplay="true"
          :interval="3000"
          :circular="true"
          indicator-color="rgba(255, 255, 255, 0.5)"
          indicator-active-color="#8B5CF6"
        >
          <swiper-item v-for="(image, index) in dishImages" :key="index" class="relative overflow-hidden rounded-lg">
            <image
              :src="image"
              class="w-full h-48 object-cover"
              mode="aspectFill"
            />
            <!-- 渐变遮罩 -->
            <view class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></view>
          </swiper-item>
        </swiper>
      </view>
      
      <!-- 食堂栏目 -->
      <view v-if="canteenStore.loading" class="text-center py-4 text-gray-500">正在加载食堂...</view>
      <view v-else-if="canteenStore.error" class="text-center py-4 text-red-500">{{ canteenStore.error }}</view>
      <view v-else>
        <swiper class="h-32" :current="currentSwiperIndex" @change="handleSwiperChange">
          <swiper-item v-for="(chunk, index) in canteenChunks" :key="index">
            <view class="flex items-center justify-between px-4 h-full">
              <CanteenItem
                v-for="canteen in chunk"
                :key="canteen.id"
                :canteen="canteen"
                @click="navigateTo(`/pages/canteen/index?id=${canteen.id}`)"
              />
              <view v-if="chunk.length < 3" v-for="i in (3 - chunk.length)" :key="'placeholder-'+i" class="w-24"></view>
            </view>
          </swiper-item>
        </swiper>
        <view class="flex justify-center mt-1 mb-2 space-x-1.5" v-if="canteenChunks.length > 1">
          <view
            v-for="(_, index) in canteenChunks"
            :key="index"
            class="h-1.5 rounded-full transition-all duration-300"
            :class="currentSwiperIndex === index ? 'w-1.5 bg-gray-600' : 'w-1.5 bg-gray-300'"
          ></view>
        </view>
      </view>

      <FilterBar @filter-change="handleFilterChange" />

      <!-- 菜品列表 -->
      <view class="text-lg font-semibold text-gray-800 my-4">
        {{ hasActiveFilters ? '筛选结果' : '今日推荐' }}
      </view>
      <view v-if="dishesStore.loading" class="text-center py-4 text-gray-500">正在加载菜品...</view>
      <view v-else-if="dishesStore.error" class="text-center py-4 text-red-500">{{ dishesStore.error }}</view>
      <view v-else-if="topThreeDishes.length > 0">
        <RecommendItem
          v-for="dish in topThreeDishes"
          :key="dish.id"
          :dish="dish"
          @click="navigateTo(`/pages/dish/index?id=${dish.id}`)"
        />
      </view>
      <view v-else class="text-center py-10 text-gray-500">
        {{ hasActiveFilters ? '没有符合条件的菜品' : '今天好像没有推荐菜品哦' }}
      </view>
    </view>

    <!-- 底部导航栏 -->
    <view class="h-20 bg-white flex border-t border-gray-200 flex-shrink-0">
      <!-- ... (这部分保持不变) ... -->
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';

// ... 导入子组件 (保持不变) ...
import SearchBar from './components/SearchBar.vue';
import CanteenItem from './components/CanteenList.vue';
import RecommendItem from './components/RecommendItem.vue';
import FilterBar from './components/FilterBar.vue';

// 导入 Store
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import { useUserStore } from '@/store/modules/use-user-store';
import type { GetDishesRequest } from '@/types/api';
import { getDishesImages } from '@/api/modules/dish';


// --- 底部导航数据 (保持不变) ---
const navItems = [ /* ... */ ];

// --- Store 实例化 (核心修改点) ---
// 2. 直接获取 store 实例
const canteenStore = useCanteenStore();
const dishesStore = useDishesStore();
const userStore = useUserStore();

// 当前筛选条件
const currentFilter = ref<GetDishesRequest['filter']>({});

// 菜品图片列表
const dishImages = ref<string[]>([]);

// 是否有激活的筛选条件
const hasActiveFilters = computed(() => {
  return Object.keys(currentFilter.value).length > 0;
});

// --- 计算属性 ---
// 3. 计算属性直接从 store 实例中读取 state
const topThreeDishes = computed(() => {
  return dishesStore.dishes; // 显示所有返回的菜品
});

const canteenChunks = computed(() => {
  const list = canteenStore.canteenList || [];
  const size = 3;
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
});

const currentSwiperIndex = ref(0);

const handleSwiperChange = (e: any) => {
  currentSwiperIndex.value = e.detail.current;
};

/**
 * 获取菜品图片列表
 */
const fetchDishImages = async () => {
  try {
    const response = await getDishesImages();
    if (response.code === 200 && response.data) {
      dishImages.value = response.data.images || [];
    }
  } catch (error) {
    console.error('获取菜品图片失败:', error);
  }
};

/**
 * 根据用户设置构建菜品筛选条件
 */
function buildDishFilterFromUserSettings(): GetDishesRequest['filter'] {
  const userInfo = userStore.userInfo;
  const filter: GetDishesRequest['filter'] = {};

  if (!userInfo) return filter;

  // 过敏原筛选 - 排除含有用户过敏原的菜品
  if (userInfo.allergens && userInfo.allergens.length > 0) {
    filter.avoidIngredients = userInfo.allergens;
  }

  // 用户偏好设置
  if (userInfo.preferences) {
    const prefs = userInfo.preferences;

    // 价格范围
    if (prefs.priceRange) {
      filter.price = {
        min: prefs.priceRange.min,
        max: prefs.priceRange.max,
      };
    }

    // 忌口食材
    if (prefs.avoidIngredients && prefs.avoidIngredients.length > 0) {
      filter.avoidIngredients = [
        ...(filter.avoidIngredients || []),
        ...prefs.avoidIngredients
      ];
    }

    // 喜好食材 - 优先推荐含有这些食材的菜品
    if (prefs.favoriteIngredients && prefs.favoriteIngredients.length > 0) {
      // 这里可以添加逻辑来提升含有喜好食材的菜品优先级
      // 暂时先不实现，留给后端处理
    }

    // 食堂偏好
    if (prefs.canteenPreferences && prefs.canteenPreferences.length > 0) {
      filter.canteenId = prefs.canteenPreferences;
    }

    // 标签偏好
    if (prefs.tagPreferences && prefs.tagPreferences.length > 0) {
      filter.tag = prefs.tagPreferences;
    }

    // 口味偏好 - 用于筛选菜品
    if (prefs.tastePreferences) {
      const taste = prefs.tastePreferences;
      // 只有当口味偏好不为0（未设置）时才应用筛选
      if (taste.spicyLevel !== undefined && taste.spicyLevel > 0) {
        filter.spicyLevel = {
          min: Math.max(0, taste.spicyLevel - 1), // 允许稍微偏离的范围
          max: Math.min(5, taste.spicyLevel + 1),
        };
      }
      if (taste.sweetness !== undefined && taste.sweetness > 0) {
        filter.sweetness = {
          min: Math.max(0, taste.sweetness - 1),
          max: Math.min(5, taste.sweetness + 1),
        };
      }
      if (taste.saltiness !== undefined && taste.saltiness > 0) {
        filter.saltiness = {
          min: Math.max(0, taste.saltiness - 1),
          max: Math.min(5, taste.saltiness + 1),
        };
      }
      if (taste.oiliness !== undefined && taste.oiliness > 0) {
        filter.oiliness = {
          min: Math.max(0, taste.oiliness - 1),
          max: Math.min(5, taste.oiliness + 1),
        };
      }
    }
  }

  return filter;
}

/**
 * 根据用户设置构建排序条件
 */
function buildDishSortFromUserSettings(): GetDishesRequest['sort'] {
  const userInfo = userStore.userInfo;
  
  // 默认排序
  let sort: GetDishesRequest['sort'] = {
    field: 'averageRating',
    order: 'desc',
  };

  // 如果用户设置了排序偏好，使用用户的设置
  if (userInfo?.settings?.displaySettings?.sortBy) {
    const sortBy = userInfo.settings.displaySettings.sortBy;
    switch (sortBy) {
      case 'rating':
        sort = { field: 'averageRating', order: 'desc' };
        break;
      case 'price_low':
        sort = { field: 'price', order: 'asc' };
        break;
      case 'price_high':
        sort = { field: 'price', order: 'desc' };
        break;
      case 'popularity':
        sort = { field: 'reviewCount', order: 'desc' };
        break;
      case 'newest':
        sort = { field: 'createdAt', order: 'desc' };
        break;
    }
  }

  return sort;
}

// 处理筛选变化
const handleFilterChange = (filter: GetDishesRequest['filter']) => {
  currentFilter.value = filter;
  
  const dishRequestParams: GetDishesRequest = {
    sort: buildDishSortFromUserSettings(),
    pagination: { page: 1, pageSize: 20 },
    filter: { isSuggestion: true, ...filter }, // 使用后端推荐 + 用户筛选条件
    search: { keyword: '' },
  };
  
  dishesStore.fetchDishes(dishRequestParams);
};

// --- 页面导航逻辑 (保持不变) ---
function handleTabSwitch(item: { path: string }) { /* ... */ }
function navigateTo(path: string) {
  if (!path) return;
  uni.navigateTo({ url: path });
}

// --- 生命周期 ---
onMounted(async () => {
  // 4. 调用 actions (保持不变)
  canteenStore.fetchCanteenList({ page: 1, pageSize: 10 });

  // 获取菜品图片
  await fetchDishImages();

  // 先获取用户信息
  await userStore.fetchProfileAction();
  
  // 获取今日推荐菜品，使用后端推荐逻辑
  const dishRequestParams: GetDishesRequest = {
    sort: buildDishSortFromUserSettings(),
    pagination: { page: 1, pageSize: 10 },
    filter: { isSuggestion: true },  // 让后端根据推荐返回菜品
    search: { keyword: '' },
  };
  dishesStore.fetchDishes(dishRequestParams);
});

// 监听用户信息变化，当偏好设置或显示设置更新时刷新菜品列表
watch(
  [
    () => userStore.userInfo?.preferences,
    () => userStore.userInfo?.settings
  ],
  ([newPreferences, newSettings], [oldPreferences, oldSettings]) => {
    // 检查偏好设置是否发生变化
    const preferencesChanged = JSON.stringify(newPreferences) !== JSON.stringify(oldPreferences);
    // 检查显示设置是否发生变化
    const settingsChanged = JSON.stringify(newSettings) !== JSON.stringify(oldSettings);
    
    if (preferencesChanged || settingsChanged) {
      console.log('用户偏好设置或显示设置已更新，刷新今日推荐菜品');
      
      const dishRequestParams: GetDishesRequest = {
        sort: buildDishSortFromUserSettings(),
        pagination: { page: 1, pageSize: 10 },
        filter: { isSuggestion: true },  // 让后端根据推荐返回菜品
        search: { keyword: '' },
      };
      dishesStore.fetchDishes(dishRequestParams);
    }
  },
  { deep: true }
);

/**
 * 下拉刷新处理函数
 */
onPullDownRefresh(async () => {
  try {
    // 重新获取菜品图片
    await fetchDishImages();
    
    // 重新获取用户信息
    await userStore.fetchProfileAction();
    
    // 重新获取食堂列表
    await canteenStore.fetchCanteenList({ page: 1, pageSize: 10 });
    
    // 重新获取菜品列表（使用后端推荐 + 当前的筛选条件）
    const dishRequestParams: GetDishesRequest = {
      sort: buildDishSortFromUserSettings(),
      pagination: { page: 1, pageSize: 20 },
      filter: { isSuggestion: true, ...currentFilter.value },
      search: { keyword: '' },
    };
    
    await dishesStore.fetchDishes(dishRequestParams);
    
    // 刷新完成后停止下拉刷新动画
    uni.stopPullDownRefresh();
    
    // 显示刷新成功提示
    uni.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1500
    });
  } catch (error) {
    console.error('下拉刷新失败:', error);
    uni.stopPullDownRefresh();
    uni.showToast({
      title: '刷新失败',
      icon: 'none'
    });
  }
});
</script>


<style scoped>
/* 仅保留在小程序与浏览器中隐藏滚动条的必要样式 */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* 菜品图片轮播样式 */
.dish-image-swiper {
  width: 100%;
  height: 192px; /* h-48 = 192px */
  border-radius: 8px;
  overflow: hidden;
}

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