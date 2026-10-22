<template>
  <view class="search-page page-content page-state-layout">
    <view class="search-toolbar">
      <view v-if="isScoped" class="search-scope">
        <text class="search-scope__name">{{
          scopeName || (scope.windowId ? t('food.thisCounter') : t('food.thisCanteen'))
        }}</text>
        <text class="search-scope__caption">{{ t('food.findDishesHere') }}</text>
      </view>
      <SearchBar
        v-model="keyword"
        editable
        :focus="inputFocused"
        :placeholder="isScoped ? t('food.searchDishesHere') : t('food.searchDishesOrCanteens')"
        @submit="handleSearch"
        @clear="handleClearSearch"
        @blur="inputFocused = false"
      />
    </view>
    <view class="search-content page-state-content" :aria-busy="loading">
      <view v-if="canteenError && (hasResults || !error)" class="error-feedback" role="alert">
        <text class="error-feedback__message">{{
          t('food.canteenSearchError', { error: canteenError })
        }}</text>
        <button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          :disabled="loading"
          @tap="retrySearch"
        >
          {{ t('food.retryCanteenSearch') }}
        </button>
      </view>
      <AsyncState
        :loading="loading"
        :initialized="initialized && !canteenError"
        :has-content="hasResults"
        :error="error"
        :refreshing-title="t('food.updatingResults')"
        :empty-title="t('food.noResultsForKeyword', { keyword: submittedKeyword })"
        empty-icon="search"
        :empty-action-text="t('food.suggestADish')"
        :retry-text="t('food.searchAgain')"
        @retry="retrySearch"
        @action="goToAddDish"
      />
      <view v-if="hasResults">
        <view v-if="searchResults.canteens.length" class="search-results">
          <text class="search-heading">{{
            t('food.canteenResultsCount', { count: searchResults.canteens.length })
          }}</text>
          <CanteenResultItem
            v-for="canteen in searchResults.canteens"
            :key="canteen.id"
            :canteen="canteen"
          />
        </view>
        <view v-if="searchResults.dishes.length" class="search-results">
          <text class="search-heading">{{
            t('food.dishResultsCount', { count: searchResults.dishes.length })
          }}</text>
          <DishResultItem v-for="dish in searchResults.dishes" :key="dish.id" :dish="dish" />
          <view :class="loadMoreError ? 'error-feedback' : 'search-state search-state--compact'">
            <text v-if="loadingMore">{{ t('food.loadingMore') }}</text>
            <template v-else-if="loadMoreError">
              <text class="error-feedback__message">{{ loadMoreError }}</text>
              <button
                class="error-feedback__action"
                hover-class="error-feedback__action--pressed"
                @tap="loadMore"
              >
                {{ t('food.retryLoadingMore') }}
              </button>
            </template>
            <button
              v-else-if="hasMore && !loading && !error"
              class="search-button search-link"
              @tap="loadMore"
            >
              {{ t('food.loadMore') }}
            </button>
            <text v-else-if="!loading && !error">{{ t('food.youVeReachedTheEnd') }}</text>
          </view>
        </view>
        <view class="search-contribution">
          <text>{{ t('food.canTFindYourDish') }}</text>
          <button class="search-button search-link" @tap="goToAddDish">
            {{ t('food.suggestADish') }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { computed, nextTick, onMounted, ref } from 'vue';
import { onHide, onLoad, onReachBottom, onShow } from '@dcloudio/uni-app';
import { useSearch, type SearchScope } from './composables/use-search';
import SearchBar from '@/components/SearchBar.vue';
import AsyncState from '@/components/AsyncState.vue';
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
</style>
