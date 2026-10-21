<template>
  <view class="home-page page-content page-state-layout">
    <!-- 主内容区 -->
    <view
      class="home-content page-state-content"
      :aria-busy="dishesStore.loading || canteenStore.loading"
    >
      <!-- 搜索栏 -->
      <SearchBar class="home-search" />

      <view
        v-if="homeError && !topThreeDishes.length"
        class="error-feedback page-state-region"
        role="alert"
      >
        <text class="error-feedback__title">首页暂时无法加载</text>
        <text class="error-feedback__message">{{ homeError }}</text>
        <button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="retryCanteens"
        >
          重新加载
        </button>
      </view>
      <template v-else>
        <!-- 食堂栏目 -->
        <scroll-view
          v-if="canteenStore.canteenList.length"
          scroll-x
          :show-scrollbar="false"
          :lower-threshold="80"
          class="canteen-scroll"
          aria-label="按食堂浏览"
          @scrolltolower="!canteenStore.error && loadMoreCanteens()"
        >
          <view class="canteen-row">
            <CanteenItem
              v-for="canteen in canteenStore.canteenList"
              :key="canteen.id"
              :canteen="canteen"
              @click="navigateTo(`/pages/canteen/index?id=${canteen.id}`)"
            />
            <button
              v-if="canteensHasMore && !canteenStore.error"
              class="canteen-more"
              :disabled="canteenStore.loadingMore"
              @click="loadMoreCanteens"
            >
              <text class="canteen-more__icon" aria-hidden="true">›</text>
              <text>{{ canteenStore.loadingMore ? '加载中…' : '更多食堂' }}</text>
            </button>
          </view>
        </scroll-view>
        <view
          v-if="homeError || canteenStore.error"
          class="canteen-feedback error-feedback"
          role="alert"
        >
          <text class="error-feedback__message">{{ homeError || canteenStore.error }}</text>
          <button
            class="error-feedback__action"
            hover-class="error-feedback__action--pressed"
            data-testid="canteen-retry"
            @click="retryCanteens"
          >
            重试加载
          </button>
        </view>

        <!-- 菜品列表 -->
        <view class="home-heading">
          {{ hasActiveFilters ? '筛选结果' : '今日推荐' }}
        </view>

        <FilterBar ref="filterBarRef" :filter="currentFilter" @filter-change="handleFilterChange" />
        <view v-if="dishesStore.loading && topThreeDishes.length" class="home-status"
          >正在更新菜品…</view
        >
        <view
          v-if="recommendError"
          class="error-feedback"
          :class="{ 'page-state-region': !topThreeDishes.length }"
          role="alert"
        >
          <text class="error-feedback__message">{{ recommendError }}</text>
          <button
            class="error-feedback__action"
            hover-class="error-feedback__action--pressed"
            @click="retryLoadRecommend"
          >
            重新加载
          </button>
        </view>
        <view v-if="topThreeDishes.length > 0">
          <RecommendItem v-for="dish in topThreeDishes" :key="dish.id" :dish="dish" />
        </view>

        <EmptyState
          v-else-if="dishesStore.loading && !recommendationsInitialized && !recommendError"
          class="page-state-region"
          title="正在加载推荐…"
          loading
        />
        <EmptyState
          class="page-state-region"
          v-else-if="
            recommendationsInitialized && !dishesStore.loading && !homeError && !recommendError
          "
          :title="hasActiveFilters ? '没有符合条件的菜品' : '暂无推荐菜品'"
          icon="search"
          :action-text="hasActiveFilters ? '清除全部筛选' : ''"
          @action="handleFilterChange({})"
        />

        <!-- 上拉加载更多：底部提示/动画（仅在有列表或正在加载更多时显示） -->
        <view
          v-if="
            !dishesStore.loading &&
            !recommendError &&
            (topThreeDishes.length > 0 || dishesStore.loadingMore || dishesHasMore)
          "
          :class="recommendMoreError ? 'error-feedback' : 'home-status home-status--footer'"
        >
          <template v-if="dishesStore.loadingMore">
            <view
              class="w-4 h-4 mr-2 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin"
            ></view>
            <text>加载中...</text>
          </template>
          <template v-else-if="recommendMoreError">
            <text class="error-feedback__message">{{ recommendMoreError }}</text>
            <button
              class="error-feedback__action"
              hover-class="error-feedback__action--pressed"
              @click="loadMoreRecommendations"
            >
              重试加载更多
            </button>
          </template>
          <template v-else-if="dishesHasMore">
            <button class="home-text-button" @click="loadMoreRecommendations">加载更多</button>
          </template>
          <template v-else>
            <text>没有更多了</text>
          </template>
        </view>
      </template>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <page-container
      :show="isFilterOpen"
      :overlay="false"
      :duration="0"
      :disable-scroll="false"
      data-testid="filter-back-helper"
      custom-style="position: fixed; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="closeFilters"
    />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { onMounted, onScopeDispose, computed, ref, watch } from 'vue';
import { onPullDownRefresh, onReachBottom, onShow, onBackPress, onHide } from '@dcloudio/uni-app';

import SearchBar from '@/components/SearchBar.vue';
import EmptyState from '@/components/EmptyState.vue';
import CanteenItem from './components/CanteenList.vue';
import RecommendItem from './components/RecommendItem.vue';
import FilterBar from './components/FilterBar.vue';

// 导入 Store
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { useDishesStore } from '@/store/modules/use-dishes-store';
import { useUserStore } from '@/store/modules/use-user-store';
import type { GetDishesRequest, RecommendationRequest, Dish } from '@/types/api';
import { getDishes, getDishesByIds } from '@/api/modules/dish';
import { getRecommendations, RecommendationScene } from '@/api/modules/recommendation';
import { toUserFriendlyErrorMessage } from '@/utils/user-friendly-error';

const canteenStore = useCanteenStore();
const dishesStore = useDishesStore();
const userStore = useUserStore();

// 当前筛选条件
const currentFilter = ref<GetDishesRequest['filter']>({});
const filterBarRef = ref<InstanceType<typeof FilterBar> | null>(null);
const isFilterOpen = computed(() => !!filterBarRef.value?.isOpen);
const closeFilters = () => filterBarRef.value?.closePanel();

onBackPress(() => {
  if (!isFilterOpen.value) return false;
  closeFilters();
  return true;
});
onHide(() => {
  homeActive = false;
  closeFilters();
});

const recommendationsInitialized = ref(false);

// 推荐会话 ID（用于无限滚动追踪）
const currentRequestId = ref<string | null>(null);

// 是否有激活的筛选条件
const hasActiveFilters = computed(() => {
  return Object.keys(currentFilter.value).length > 0;
});

const homeError = ref<string | null>(null);
// 推荐菜品加载错误状态
const recommendError = ref<string | null>(null);
const recommendMoreError = ref('');
let recommendationRun = 0;
let disposed = false;
onScopeDispose(() => {
  disposed = true;
  recommendationRun += 1;
});
let preparingProfileRun: number | null = null;
let homeActive = false;
const homeAudience = computed(() => `${userStore.sessionVersion}:${userStore.isLoggedIn}`);
let loadedHomeAudience: string | null = null;
const canteenLoadMode = ref<'refresh' | 'more'>('refresh');

watch(
  homeAudience,
  () => {
    recommendationRun += 1;
    currentRequestId.value = null;
    homeError.value = null;
    recommendError.value = null;
    recommendMoreError.value = '';
    recommendationsInitialized.value = false;
    dishesStore.dishes = [];
    dishesStore.pagination = null;
    dishesStore.error = null;
    dishesStore.loading = false;
    dishesStore.loadingMore = false;
  },
  { flush: 'sync' }
);

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

const canteensHasMore = computed(() => {
  const pagination = canteenStore.pagination;
  return pagination && (pagination.totalPages <= 0 || pagination.page < pagination.totalPages);
});

const loadMoreCanteens = async () => {
  if (canteenStore.loading || canteenStore.loadingMore || !canteensHasMore.value) return;
  canteenLoadMode.value = 'more';
  try {
    await canteenStore.loadMoreCanteenList();
  } catch (error) {
    console.error('加载更多食堂失败:', error);
  }
};

const retryCanteens = async () => {
  if (canteenStore.loading || canteenStore.loadingMore) return;
  if (!homeError.value && canteenLoadMode.value === 'more') await loadMoreCanteens();
  else await loadHomeForSession(true);
};

/**
 * 加载推荐菜品（使用推荐 API）
 */
type RecommendationOutcome = 'success' | 'failed' | 'superseded';

const fetchRecommendations = async (
  options: {
    reset: boolean;
    append?: boolean;
    home?: { refreshCanteens: boolean };
  } = { reset: true }
): Promise<RecommendationOutcome> => {
  const audience = homeAudience.value;
  const run = ++recommendationRun;
  const ownsResult = () =>
    !disposed && homeAudience.value === audience && run === recommendationRun;
  const append = options.append === true;

  // 设置加载状态
  dishesStore.loadingMore = append;
  dishesStore.loading = !append;
  recommendMoreError.value = '';
  if (!append) recommendError.value = null;
  if (options.home) homeError.value = null;

  try {
    // 如果是重置，清空 requestId，让后端生成新的
    if (options.reset) {
      currentRequestId.value = null;
    }

    if (options.home) {
      preparingProfileRun = run;
      try {
        if (options.home.refreshCanteens || canteenStore.canteenList.length === 0) {
          canteenLoadMode.value = 'refresh';
          await canteenStore.fetchCanteenList({ page: 1, pageSize: 9 }, ownsResult);
          if (!ownsResult()) return 'superseded';
        }
        await userStore.fetchProfileAction(ownsResult);
      } catch (error) {
        if (!ownsResult()) return 'superseded';
        homeError.value = toUserFriendlyErrorMessage(error);
        console.error('加载首页数据失败:', error);
        return 'failed';
      } finally {
        if (preparingProfileRun === run) preparingProfileRun = null;
      }
      if (!ownsResult()) return 'superseded';
    }

    const page = options.reset ? 1 : currentDishPage.value + 1;

    if (!userStore.isLoggedIn) {
      const response = await getDishes({
        filter: currentFilter.value,
        search: { keyword: '' },
        sort: { field: 'averageRating', order: 'desc' },
        pagination: { page, pageSize: 10 },
      });
      if (!ownsResult()) return 'superseded';
      if (response.code !== 200 || !response.data) throw new Error('加载菜品失败');
      dishesStore.dishes = append
        ? [...dishesStore.dishes, ...response.data.items]
        : response.data.items;
      dishesStore.pagination = response.data.meta;
      recommendationsInitialized.value = true;
      return 'success';
    }

    // 构造推荐请求参数，传递 requestId 以维护会话一致性
    const params: RecommendationRequest = {
      scene: RecommendationScene.HOME,
      requestId: currentRequestId.value || undefined,
      filter: currentFilter.value,
      pagination: { page, pageSize: 10 },
    };

    const response = await getRecommendations(params);
    if (!ownsResult()) return 'superseded';
    if (response.code !== 200 || !response.data)
      throw new Error(response.message || '加载推荐菜品失败');

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
        recommendError.value = null;
      }
      recommendationsInitialized.value = true;
      return 'success';
    }

    // 批量获取完整的菜品信息
    const dishesResponse = await getDishesByIds(dishIds);
    if (!ownsResult()) return 'superseded';
    if (dishesResponse.code !== 200 || !dishesResponse.data)
      throw new Error(dishesResponse.message || '加载菜品详情失败');

    const fullDishes = dishesResponse.data.items;

    // 按照推荐顺序排序
    const sortedDishes = dishIds
      .map(id => fullDishes.find(dish => dish.id === id))
      .filter((dish): dish is Dish => dish?.status === 'online');

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
    recommendationsInitialized.value = true;
    if (!append) recommendError.value = null;
    return 'success';
  } catch (error: any) {
    if (!ownsResult()) return 'superseded';
    if (!append) {
      recommendError.value = options.home
        ? '加载首页数据失败，请重试'
        : error?.message?.includes('400') || error?.message?.includes('Bad Request')
          ? '网络开小差了，请稍后再试'
          : '加载推荐菜品失败，请稍后再试';
    } else recommendMoreError.value = '加载更多菜品失败，请重试';
    console.error('加载推荐菜品失败:', error);
    return 'failed';
  } finally {
    if (ownsResult()) {
      dishesStore.loadingMore = false;
      dishesStore.loading = false;
    }
  }
};

// 处理筛选变化
const handleFilterChange = async (filter: GetDishesRequest['filter']) => {
  currentFilter.value = filter;
  await fetchRecommendations({ reset: true });
};

// 重新加载推荐菜品
const retryLoadRecommend = async () => {
  await fetchRecommendations({ reset: true });
};

function navigateTo(path: string) {
  if (!path) return;
  uni.navigateTo({ url: path });
}

// --- 生命周期 ---
onShow(() => {
  homeActive = true;
  ensureHomeAudience();
});

async function loadHomeForSession(refreshCanteens = false): Promise<RecommendationOutcome> {
  loadedHomeAudience = homeAudience.value;
  return fetchRecommendations({ reset: true, home: { refreshCanteens } });
}

function ensureHomeAudience() {
  if (homeActive && loadedHomeAudience !== homeAudience.value) void loadHomeForSession();
}

onMounted(() => {
  homeActive = true;
  ensureHomeAudience();
});

watch(homeAudience, ensureHomeAudience);

// 监听用户信息变化，当偏好设置或显示设置更新时刷新菜品列表
watch(
  [() => userStore.userInfo?.preferences, () => userStore.userInfo?.settings],
  async ([newPreferences, newSettings], [oldPreferences, oldSettings]) => {
    if (!userStore.isLoggedIn) return;
    // The active preparation will request recommendations with the refreshed profile.
    if (preparingProfileRun === recommendationRun) return;
    // 检查偏好设置是否发生变化
    const preferencesChanged = JSON.stringify(newPreferences) !== JSON.stringify(oldPreferences);
    // 检查显示设置是否发生变化
    const settingsChanged = JSON.stringify(newSettings) !== JSON.stringify(oldSettings);

    if (preferencesChanged || settingsChanged) {
      if (!homeActive) {
        loadedHomeAudience = null;
        return;
      }
      console.log('用户偏好设置或显示设置已更新，刷新今日推荐菜品');

      await fetchRecommendations({ reset: true });
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
    await loadHomeForSession(true);
  } finally {
    uni.stopPullDownRefresh();
  }
});

/**
 * 触底上拉加载更多（小程序页面触底）
 */
const loadMoreRecommendations = async () => {
  // 避免在首次加载/追加加载中重复触发
  if (dishesStore.loading || dishesStore.loadingMore) return;
  if (!dishesHasMore.value) return;

  await fetchRecommendations({ reset: false, append: true });
};
onReachBottom(async () => {
  if (!recommendMoreError.value) await loadMoreRecommendations();
});
</script>

<style scoped>
.home-page {
  background: #ffffff;
  color: #1f2937;
}
.home-content {
  padding: 16px;
  background: #ffffff;
  box-sizing: border-box;
}
.home-search {
  margin-bottom: 20px;
}
.canteen-scroll {
  width: 100%;
  white-space: nowrap;
}
.canteen-row {
  display: inline-flex;
  align-items: flex-start;
  min-width: 100%;
  padding: 0;
  white-space: nowrap;
}
.canteen-more {
  display: inline-flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 78px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 12px;
  background: #f5f6f8;
  color: #660874;
  font-size: 12px;
  line-height: 1.4;
}
.canteen-more::after,
.home-text-button::after {
  border: 0;
}
.canteen-more:active,
.home-text-button:active {
  background: #f4f4f5;
}
.canteen-more:focus-visible,
.home-text-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.home-heading {
  margin: 24px 0 12px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}
.canteen-more__icon {
  margin-bottom: 2px;
  font-size: 27px;
  line-height: 1;
}
.home-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 8px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}
.home-status--footer {
  padding: 18px 0;
  font-size: 12px;
}
.home-text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 4px 0 0;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #660874;
  font-size: 14px;
  line-height: 1.4;
}
@media (hover: hover) {
  .home-text-button:hover {
    background: #f4f4f5;
  }
}
</style>
