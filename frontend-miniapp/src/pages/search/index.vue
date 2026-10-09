<template>
  <view class="search-page page-content">
    <view class="search-toolbar">
      <view v-if="isScoped" class="search-scope">
        <text class="search-scope__name">{{
          scopeName || (scope.windowId ? '当前窗口' : '当前食堂')
        }}</text>
        <text class="search-scope__caption">在这里查找菜品</text>
      </view>
      <SearchBar
        v-model="keyword"
        editable
        :focus="inputFocused"
        :placeholder="isScoped ? '搜索这里的菜品' : '搜索菜品或食堂'"
        @submit="handleSearch"
        @clear="handleClearSearch"
        @blur="inputFocused = false"
      />
    </view>
    <view class="search-content" :aria-busy="loading">
      <view v-if="loading && hasResults" class="search-state search-state--compact"
        >正在更新结果…</view
      >
      <view v-if="canteenError" class="search-state" role="alert">
        <text>食堂搜索未完成：{{ canteenError }}</text>
        <button class="search-button search-link" :disabled="loading" @tap="retrySearch">
          重试食堂搜索
        </button>
      </view>
      <view v-if="error" class="search-state" role="alert">
        <text>{{ error }}</text>
        <button class="search-button search-link" @tap="retrySearch">重新搜索</button>
      </view>
      <view v-if="hasResults">
        <view v-if="searchResults.canteens.length" class="search-results">
          <text class="search-heading">食堂 · {{ searchResults.canteens.length }}</text>
          <CanteenResultItem
            v-for="canteen in searchResults.canteens"
            :key="canteen.id"
            :canteen="canteen"
          />
        </view>
        <view v-if="searchResults.dishes.length" class="search-results">
          <text class="search-heading">菜品 · 已显示 {{ searchResults.dishes.length }} 道</text>
          <DishResultItem v-for="dish in searchResults.dishes" :key="dish.id" :dish="dish" />
          <view class="search-state search-state--compact">
            <text v-if="loadingMore">正在加载更多…</text>
            <template v-else-if="loadMoreError">
              <text>{{ loadMoreError }}</text>
              <button class="search-button search-link" @tap="loadMore">重试加载更多</button>
            </template>
            <button
              v-else-if="hasMore && !loading && !error"
              class="search-button search-link"
              @tap="loadMore"
            >
              加载更多
            </button>
            <text v-else-if="!loading && !error">没有更多了</text>
          </view>
        </view>
        <view class="search-contribution">
          <text>没找到想要的菜品？</text>
          <button class="search-button search-link" @tap="goToAddDish">添加菜品</button>
        </view>
      </view>
      <view v-else-if="!loading && !error && !canteenError && initialized" class="search-state">
        <text class="search-empty-title">未找到“{{ submittedKeyword }}”相关结果</text>
        <text>{{
          isScoped ? '试试其他菜名，看看这里的选择。' : '试试其他菜名，或按食堂名称搜索。'
        }}</text>
        <button class="search-button search-link" @tap="goToAddDish">添加这道菜</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { onHide, onLoad, onReachBottom, onShow } from '@dcloudio/uni-app';
import { useSearch, type SearchScope } from './composables/use-search';
import SearchBar from '@/components/SearchBar.vue';
import CanteenResultItem from './components/CanteenResultItem.vue';
import DishResultItem from './components/DishResultItem.vue';

const scope = ref<SearchScope>({});
const scopeName = ref('');
const isScoped = computed(() => !!(scope.value.windowId || scope.value.canteenId));
const inputFocused = ref(false);
const {
  keyword,
  searchResults,
  hasResults,
  loading,
  loadingMore,
  hasMore,
  error,
  canteenError,
  loadMoreError,
  submittedKeyword,
  initialized,
  search,
  loadMore,
  clearSearch,
  resetResults,
  retrySearch,
  refreshPreferredSort,
  goToAddDish,
} = useSearch(scope);
const handleSearch = () => {
  inputFocused.value = false;
  return keyword.value.trim() ? search() : clearSearch();
};
const handleClearSearch = async () => {
  inputFocused.value = false;
  clearSearch();
  await nextTick();
  inputFocused.value = true;
};
onLoad(options => {
  const nextScope: SearchScope = options?.windowId
    ? { windowId: options.windowId }
    : options?.canteenId
      ? { canteenId: options.canteenId }
      : {};
  if (scope.value.windowId !== nextScope.windowId || scope.value.canteenId !== nextScope.canteenId)
    resetResults();
  scope.value = nextScope;
  scopeName.value = options?.scopeName || '';
  try {
    scopeName.value = decodeURIComponent(scopeName.value);
  } catch {
    // 宿主已解码的名称可包含字面百分号
  }
});
onMounted(() => {
  inputFocused.value = true;
});
onHide(() => {
  inputFocused.value = false;
});
onReachBottom(() => {
  if (!loadMoreError.value) void loadMore();
});
onShow(() => {
  void refreshPreferredSort();
});
</script>

<style scoped>
.search-page {
  background: #fff;
  color: #1f2937;
}
.search-toolbar {
  position: sticky;
  top: var(--window-top, 0px);
  z-index: 10;
  padding: 16px;
  background: #fff;
  animation: search-arrival 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.search-scope {
  margin-bottom: 16px;
}
.search-scope__name {
  display: block;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.search-scope__caption {
  display: block;
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
.search-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  border: 0;
  padding: 0 12px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1.5;
  border-radius: 10px;
}
.search-button::after {
  border: 0;
}
.search-button:active {
  opacity: 0.72;
}
.search-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.search-content {
  padding: 0 16px 20px;
}
.search-heading {
  display: block;
  padding: 12px 0 4px;
  color: #667085;
  font-size: 13px;
  font-weight: 500;
}
.search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 4px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
  overflow-wrap: anywhere;
}
.search-state--compact {
  padding: 16px 0;
}
.search-empty-title {
  color: #1f2937;
  font-size: 16px;
  font-weight: 500;
}
.search-link {
  color: #660874;
}
.search-contribution {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 12px;
  border-top: 1px solid #e5e7eb;
  padding: 12px 0;
  color: #667085;
  font-size: 13px;
}
@keyframes search-arrival {
  from {
    transform: translateY(6px);
    opacity: 0.8;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .search-toolbar {
    animation: none;
  }
}
</style>
