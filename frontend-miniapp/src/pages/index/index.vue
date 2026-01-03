<template>
  <view class="min-h-screen bg-white rounded-lg overflow-hidden flex flex-col">
    <!-- 骨架屏 -->
    <IndexSkeleton v-if="isInitialLoading" />
    
    <!-- 主内容区 -->
    <view v-else class="flex-1 overflow-y-auto px-4 hide-scrollbar">
      <!-- 搜索栏 -->
      <SearchBar />

      <!-- 菜品图片轮播 -->
      <view v-if="dishImages.length>0" class="mb-4">
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
              :aria-label="`推荐菜品展示图片 ${index + 1}`"
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
      <view v-else-if="recommendError" class="text-center py-8">
        <view class="text-gray-400 mb-2">
          <text class="iconfont icon-Sleeping" :style="{ fontSize: '4rem' }"></text>
        </view>
        <view class="text-black text-sm">{{ recommendError }}</view>
        <view class="mt-3">
          <button 
            class="px-4 py-2 bg-ts-purple/10 text-ts-purple border border-ts-purple/30 rounded-full text-sm active:bg-ts-purple/20 transition-colors"
            @click="retryLoadRecommend"
          >
            重新加载
          </button>
        </view>
      </view>
      <view v-else-if="dishesStore.error && hasActiveFilters" class="text-center py-4 text-red-500">{{ dishesStore.error }}</view>
      <view v-else-if="topThreeDishes.length > 0">
        <RecommendItem
          v-for="dish in topThreeDishes"
          :key="dish.id"
          :dish="dish"
          @click="navigateTo(`/pages/dish/index?id=${dish.id}`)"
        />
      </view>

      <!-- 上拉加载更多：底部提示/动画（仅在有列表或正在加载更多时显示） -->
      <view v-if="topThreeDishes.length > 0 || dishesStore.loadingMore" class="flex items-center justify-center py-4 text-gray-500 text-sm">
        <template v-if="dishesStore.loadingMore">
          <view class="w-4 h-4 mr-2 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin"></view>
          <text>加载中...</text>
        </template>
        <template v-else-if="dishesHasMore">
          <text>上拉加载更多</text>
        </template>
        <template v-else>
          <text>没有更多了</text>
        </template>
      </view>

      <view v-else class="text-center py-10 text-gray-500">
        {{ hasActiveFilters ? '没有符合条件的菜品' : '今天好像没有推荐菜品哦' }}
      </view>
    </view>

    
  </view>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue';
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';

// ... 导入子组件 (保持不变) ...
import SearchBar from './components/SearchBar.vue';
import CanteenItem from './components/CanteenList.vue';
import RecommendItem from './components/RecommendItem.vue';
import FilterBar from './components/FilterBar.vue';
import { IndexSkeleton } from '@/components/skeleton';

// 导入 Store
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import { useUserStore } from '@/store/modules/use-user-store';
import type { GetDishesRequest, RecommendationRequest } from '@/types/api';
import { getDishesImages, getDishes, getDishesByIds } from '@/api/modules/dish';
import { getRecommendations, RecommendationScene } from '@/api/modules/recommendation';


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

// 是否处于初始加载状态（用于显示骨架屏）
const isInitialLoading = ref(true);

// 推荐会话 ID（用于无限滚动追踪）
const currentRequestId = ref<string | null>(null);

// 是否有激活的筛选条件
const hasActiveFilters = computed(() => {
  return Object.keys(currentFilter.value).length > 0;
});

// 推荐菜品加载错误状态
const recommendError = ref<string | null>(null);


const dishesHasMore = computed(() => {
  const meta = dishesStore.pagination;
  if (!meta) return false;
  
  // 无限滚动模式：totalPages = -1 表示可以继续加载
  if (meta.totalPages === -1) {
    // 在无限滚动模式下，总是可以尝试加载更多
    // 后端会在没有数据时返回空数组和 totalPages = 0
    return true;
  }
  
  // 如果 totalPages = 0，表示没有数据了
  if (meta.totalPages === 0) {
    return false;
  }
  
  // 普通分页模式
  return meta.page < meta.totalPages;
});



const currentDishPage = computed(() => dishesStore.pagination?.page ?? 1);

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

const handleSwiperChange = async (e: any) => {
  const newIndex = e.detail.current;
  currentSwiperIndex.value = newIndex;
  
  // 当滑动到最后一个 swiper-item 时，加载更多食堂
  if (newIndex === canteenChunks.value.length - 1 && canteenStore.pagination.page < canteenStore.pagination.totalPages) {
    try {
      await canteenStore.loadMoreCanteenList();
    } catch (error) {
      console.error('加载更多食堂失败:', error);
    }
  }
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
 * 加载推荐菜品（使用推荐 API）
 */
const fetchRecommendations = async (options: { reset: boolean; append?: boolean } = { reset: true }) => {
  const append = options.append === true;
  
  // 设置加载状态
  if (append) {
    dishesStore.loadingMore = true;
  } else {
    dishesStore.loading = true;
  }
  
  try {
    // 如果是重置，清空 requestId，让后端生成新的
    if (options.reset) {
      currentRequestId.value = null;
    }

    const page = options.reset ? 1 : currentDishPage.value + 1;
    
    // 构造推荐请求参数，传递 requestId 以维护会话一致性
    const params: RecommendationRequest = {
      scene: RecommendationScene.HOME,
      requestId: currentRequestId.value || undefined,
      filter: currentFilter.value,
      pagination: { page, pageSize: 10 },
    };

    const response = await getRecommendations(params);
    
    if (response.code === 200 && response.data) {
      // 使用后端返回的 requestId
      if (response.data.requestId) {
        currentRequestId.value = response.data.requestId;
      }
      
      // 获取推荐的菜品 ID 列表
      const dishIds = response.data.items.map(item => item.id);
      
      if (dishIds.length === 0) {
        // 没有更多推荐了
        if (append) {
          // 如果是追加模式，保持现有数据，只更新分页信息
          dishesStore.pagination = response.data.meta;
        } else {
          // 如果是重置模式，清空数据
          dishesStore.dishes = [];
          dishesStore.pagination = response.data.meta;
        }
        return;
      }

      // 批量获取完整的菜品信息
      const dishesResponse = await getDishesByIds(dishIds);

      if (dishesResponse.code === 200 && dishesResponse.data) {
        const fullDishes = dishesResponse.data.items;

        // 按照推荐顺序排序
        const sortedDishes = dishIds
          .map(id => fullDishes.find(dish => dish.id === id))
          .filter(dish => dish != null);

        // 检查是否有菜品缺失（竞态条件：菜品在两次调用之间被删除或下线）
        const missingCount = dishIds.length - sortedDishes.length;
        if (missingCount > 0) {
          console.warn(`推荐结果中有 ${missingCount} 个菜品不可用（可能已下线或被删除）`);
        }

        if (append) {
          dishesStore.dishes = [...dishesStore.dishes, ...sortedDishes];
        } else {
          dishesStore.dishes = sortedDishes;
        }
        
        dishesStore.pagination = response.data.meta;
      }
    }
  } catch (error) {
    console.error('加载推荐菜品失败:', error);
    throw error;
  } finally {
    if (append) {
      dishesStore.loadingMore = false;
    } else {
      dishesStore.loading = false;
    }
  }
};

// 处理筛选变化
const handleFilterChange = async (filter: GetDishesRequest['filter']) => {
  currentFilter.value = filter;
  
  // 筛选条件变化时重置 requestId，获取新的推荐会话
  currentRequestId.value = null;
  
  // 使用推荐 API，传递筛选条件
  try {
    await fetchRecommendations({ reset: true });
    recommendError.value = null;
  } catch (error: any) {
    if (error?.message?.includes('400') || error?.message?.includes('Bad Request')) {
      recommendError.value = '网络开小差了，请稍后再试';
    } else {
      recommendError.value = '加载推荐菜品失败，请稍后再试';
    }
    console.error('筛选推荐菜品失败:', error);
  }
};

// 重新加载推荐菜品
const retryLoadRecommend = async () => {
  recommendError.value = null;
  currentFilter.value = {}; // 清空筛选条件
  currentRequestId.value = null; // 重置会话 ID
  try {
    await fetchRecommendations({ reset: true });
  } catch (error: any) {
    if (error?.message?.includes('400') || error?.message?.includes('Bad Request')) {
      recommendError.value = '网络开小差了，请稍后再试';
    } else {
      recommendError.value = '加载推荐菜品失败，请稍后再试';
    }
    console.error('重新加载推荐菜品失败:', error);
  }
};

// --- 页面导航逻辑 (保持不变) ---
function handleTabSwitch(item: { path: string }) { /* ... */ }
function navigateTo(path: string) {
  if (!path) return;
  uni.navigateTo({ url: path });
}

// --- 生命周期 ---
onMounted(async () => {
  try {
    // 加载食堂列表
    canteenStore.fetchCanteenList({ page: 1, pageSize: 9 });

    // 获取菜品图片
    await fetchDishImages();

    // 先获取用户信息
    await userStore.fetchProfileAction();
    
    // 获取今日推荐菜品，使用推荐 API
    try {
      await fetchRecommendations({ reset: true });
      recommendError.value = null; // 成功时清除错误
    } catch (error: any) {
      // 检查是否是HTTP 400错误或其他网络错误
      if (error?.message?.includes('400') || error?.message?.includes('Bad Request')) {
        recommendError.value = '网络开小差了，请稍后再试';
      } else {
        recommendError.value = '加载推荐菜品失败，请稍后再试';
      }
      console.error('获取推荐菜品失败:', error);
    }
  } finally {
    // 无论成功失败，都结束初始加载状态
    isInitialLoading.value = false;
  }
});

// 监听用户信息变化，当偏好设置或显示设置更新时刷新菜品列表
watch(
  [
    () => userStore.userInfo?.preferences,
    () => userStore.userInfo?.settings
  ],
  async ([newPreferences, newSettings], [oldPreferences, oldSettings]) => {
    // 检查偏好设置是否发生变化
    const preferencesChanged = JSON.stringify(newPreferences) !== JSON.stringify(oldPreferences);
    // 检查显示设置是否发生变化
    const settingsChanged = JSON.stringify(newSettings) !== JSON.stringify(oldSettings);
    
    if (preferencesChanged || settingsChanged) {
      console.log('用户偏好设置或显示设置已更新，刷新今日推荐菜品');
      
      try {
        // 使用推荐 API，保持当前的筛选条件
        await fetchRecommendations({ reset: true });
        recommendError.value = null; // 成功时清除错误
      } catch (error: any) {
        if (error?.message?.includes('400') || error?.message?.includes('Bad Request')) {
          recommendError.value = '网络开小差了，请稍后再试';
        } else {
          recommendError.value = '加载推荐菜品失败，请稍后再试';
        }
        console.error('刷新推荐菜品失败:', error);
      }
    }
  },
  { deep: true }
);

/**
 * 下拉刷新处理函数
 * 重置 requestId 以获取不同的推荐内容
 */
onPullDownRefresh(async () => {
  try {
    // 重新获取菜品图片
    await fetchDishImages();
    
    // 重新获取用户信息
    await userStore.fetchProfileAction();
    
    // 重新获取食堂列表
    await canteenStore.fetchCanteenList({ page: 1, pageSize: 10 });
    
    // 下拉刷新时清除 requestId，让用户看到不同的推荐内容
    currentRequestId.value = null;
    
    // 重新获取菜品列表（统一使用推荐 API）
    try {
      await fetchRecommendations({ reset: true });
      recommendError.value = null; // 成功时清除错误
    } catch (error: any) {
      if (error?.message?.includes('400') || error?.message?.includes('Bad Request')) {
        recommendError.value = '网络开小差了，请稍后再试';
      } else {
        recommendError.value = '加载推荐菜品失败，请稍后再试';
      }
      console.error('下拉刷新菜品失败:', error);
    }
    
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

/**
 * 触底上拉加载更多（小程序页面触底）
 */
onReachBottom(async () => {
  // 避免在首次加载/追加加载中重复触发
  if (dishesStore.loading || dishesStore.loadingMore) return;
  if (!dishesHasMore.value) return;

  try {
    // 统一使用推荐 API（保持 requestId 会话，支持筛选条件）
    await fetchRecommendations({ reset: false, append: true });
  } catch (err) {
    console.error('上拉加载更多失败:', err);
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