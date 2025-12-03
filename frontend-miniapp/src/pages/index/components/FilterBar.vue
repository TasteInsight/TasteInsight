<!-- @/pages/index/components/FilterBar.vue -->
<template>
  <view class="relative">
    <!-- 筛选标签栏 -->
    <scroll-view scroll-x class="w-full py-3 filter-scrollbar">
      <view class="flex gap-3 px-1 mb-4">
        <view
          v-for="filter in filterOptions"
          :key="filter.key"
          class="inline-flex items-center rounded-lg h-[48px] px-4 text-base text-gray-700 bg-gray-100 transition-all duration-200 whitespace-nowrap"
          :class="(activeFilter === filter.key || hasActiveValue(filter.key))
            ? 'bg-ts-purple !text-white'
            : ''"
          @click="toggleFilter(filter.key)"
        >
          <text>{{ filter.label }}</text>
          <text v-if="hasActiveValue(filter.key)" class="ml-1 text-xs">✓</text>
        </view>
      </view>
    </scroll-view>

    <!-- 点击遮罩关闭筛选面板 -->
    <view
      v-if="activeFilter"
      class="fixed inset-0 bg-black/15 z-[5]"
      @tap="closeFilterPanel"
    ></view>

    <!-- 筛选面板 -->
    <view v-if="activeFilter" class="relative z-10 border border-gray-200 bg-white rounded-lg shadow-lg p-4 mb-4">
      <!-- 价格筛选 -->
      <view v-if="activeFilter === 'price'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">价格区间</view>
        <!-- 预设选项 -->
        <view class="flex flex-wrap gap-2 mb-4">
          <view
            v-for="option in priceOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="selectedPrice === option.value 
              ? 'bg-ts-purple text-white border-ts-purple' 
              : 'bg-gray-100 text-gray-700 border-gray-200'"
            @click="selectPrice(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
        <!-- 自定义输入 -->
        <view class="text-sm font-medium text-gray-700 mb-2">自定义价格范围</view>
        <view class="flex items-center gap-2">
          <input
            v-model="customPriceMin"
            type="number"
            placeholder="最低价"
            class="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm"
            @input="onCustomPriceInput"
          />
          <text class="text-gray-500">-</text>
          <input
            v-model="customPriceMax"
            type="number"
            placeholder="最高价"
            class="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm"
            @input="onCustomPriceInput"
          />
          <text class="text-gray-500 text-sm">元</text>
        </view>
        <view v-if="priceError" class="text-xs text-red-500 mt-1">{{ priceError }}</view>
      </view>

      <!-- 评分筛选 -->
      <view v-if="activeFilter === 'rating'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">最低评分</view>
        <!-- 预设选项 -->
        <view class="flex flex-wrap gap-2 mb-4">
          <view
            v-for="option in ratingOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="selectedRating === option.value && customRatingMin === '' && customRatingMax === ''
              ? 'bg-ts-purple text-white border-ts-purple' 
              : 'bg-gray-100 text-gray-700 border-gray-200'"
            @click="selectRating(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
        <!-- 自定义输入 -->
        <view class="text-sm font-medium text-gray-700 mb-2">自定义评分范围</view>
        <view class="flex items-center gap-2">
          <input
            v-model="customRatingMin"
            type="digit"
            placeholder="最低分"
            class="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm"
            @input="onCustomRatingInput"
          />
          <text class="text-gray-500">-</text>
          <input
            v-model="customRatingMax"
            type="digit"
            placeholder="最高分"
            class="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm"
            @input="onCustomRatingInput"
          />
          <text class="text-gray-500 text-sm">分</text>
        </view>
        <view class="text-xs text-gray-400 mt-1">评分范围：0-5分</view>
        <view v-if="ratingError" class="text-xs text-red-500 mt-1">{{ ratingError }}</view>
      </view>

      <!-- 用餐时段筛选 -->
      <view v-if="activeFilter === 'mealTime'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">用餐时段</view>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="option in mealTimeOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="selectedMealTime.includes(option.value) 
              ? 'bg-ts-purple text-white border-ts-purple' 
              : 'bg-gray-100 text-gray-700 border-gray-200'"
            @click="toggleMealTime(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <!-- 口味筛选 (范围选择) -->
      <view v-if="activeFilter === 'taste'" class="filter-content">
        <view class="text-xs text-gray-400 mb-4">提示：0 表示不限，1-5 表示程度</view>
        <!-- 辣度 -->
        <view class="mb-6">
          <view class="flex justify-between items-center mb-3">
            <text class="text-sm font-medium text-gray-700">辣度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('spicy', selectedSpicyMin, selectedSpicyMax) }}</text>
          </view>
          <view class="px-2">
            <view class="flex items-center gap-3 mb-2">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最小</text>
              <slider 
                :value="selectedSpicyMin" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#ef4444"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('spicy', e.detail.value, true)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedSpicyMin === 0 ? '不限' : selectedSpicyMin }}</text>
            </view>
            <view class="flex items-center gap-3">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最大</text>
              <slider 
                :value="selectedSpicyMax" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#ef4444"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('spicy', e.detail.value, false)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedSpicyMax === 0 ? '不限' : selectedSpicyMax }}</text>
            </view>
          </view>
        </view>

        <!-- 咸度 -->
        <view class="mb-6">
          <view class="flex justify-between items-center mb-3">
            <text class="text-sm font-medium text-gray-700">咸度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('salty', selectedSaltyMin, selectedSaltyMax) }}</text>
          </view>
          <view class="px-2">
            <view class="flex items-center gap-3 mb-2">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最小</text>
              <slider 
                :value="selectedSaltyMin" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#f59e0b"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('salty', e.detail.value, true)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedSaltyMin === 0 ? '不限' : selectedSaltyMin }}</text>
            </view>
            <view class="flex items-center gap-3">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最大</text>
              <slider 
                :value="selectedSaltyMax" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#f59e0b"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('salty', e.detail.value, false)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedSaltyMax === 0 ? '不限' : selectedSaltyMax }}</text>
            </view>
          </view>
        </view>

        <!-- 甜度 -->
        <view class="mb-6">
          <view class="flex justify-between items-center mb-3">
            <text class="text-sm font-medium text-gray-700">甜度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('sweet', selectedSweetMin, selectedSweetMax) }}</text>
          </view>
          <view class="px-2">
            <view class="flex items-center gap-3 mb-2">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最小</text>
              <slider 
                :value="selectedSweetMin" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#ec4899"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('sweet', e.detail.value, true)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedSweetMin === 0 ? '不限' : selectedSweetMin }}</text>
            </view>
            <view class="flex items-center gap-3">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最大</text>
              <slider 
                :value="selectedSweetMax" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#ec4899"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('sweet', e.detail.value, false)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedSweetMax === 0 ? '不限' : selectedSweetMax }}</text>
            </view>
          </view>
        </view>

        <!-- 油腻度 -->
        <view>
          <view class="flex justify-between items-center mb-3">
            <text class="text-sm font-medium text-gray-700">油腻度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('oily', selectedOilyMin, selectedOilyMax) }}</text>
          </view>
          <view class="px-2">
            <view class="flex items-center gap-3 mb-2">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最小</text>
              <slider 
                :value="selectedOilyMin" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#ca8a04"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('oily', e.detail.value, true)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedOilyMin === 0 ? '不限' : selectedOilyMin }}</text>
            </view>
            <view class="flex items-center gap-3">
              <text class="text-xs text-gray-500 w-10 flex-shrink-0">最大</text>
              <slider 
                :value="selectedOilyMax" 
                :min="0" 
                :max="5" 
                :step="1"
                activeColor="#ca8a04"
                backgroundColor="#e5e7eb"
                block-size="20"
                class="flex-1"
                @change="(e: any) => onTasteSliderChange('oily', e.detail.value, false)"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedOilyMax === 0 ? '不限' : selectedOilyMax }}</text>
            </view>
          </view>
        </view>
        <view v-if="tasteError" class="text-xs text-red-500 mt-2">{{ tasteError }}</view>
      </view>

      <!-- 荤素偏好筛选 -->
      <view v-if="activeFilter === 'meat'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">荤素偏好</view>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="option in meatOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="selectedMeat.includes(option.value) 
              ? 'bg-ts-purple text-white border-ts-purple' 
              : 'bg-gray-100 text-gray-700 border-gray-200'"
            @click="toggleMeat(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <!-- 标签筛选 -->
      <view v-if="activeFilter === 'tag'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">菜品标签</view>
        <view class="flex flex-wrap gap-2 mb-4">
          <view
            v-for="option in tagOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="selectedTags.includes(option.value) 
              ? 'bg-ts-purple text-white border-ts-purple' 
              : 'bg-gray-100 text-gray-700 border-gray-200'"
            @click="toggleTag(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
        <!-- 自定义输入 -->
        <view class="text-sm font-medium text-gray-700 mb-2">自定义标签</view>
        <view class="flex items-center gap-2 mb-2">
          <input
            v-model="customTagInput"
            type="text"
            placeholder="输入标签名称"
            class="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm"
            @confirm="addCustomTag"
          />
          <view
            class="px-3 py-1.5 rounded-lg text-sm cursor-pointer bg-ts-purple text-white"
            @click="addCustomTag"
          >
            添加
          </view>
        </view>
        <!-- 已添加的自定义标签 -->
        <view v-if="customTags.length > 0" class="flex flex-wrap gap-2">
          <view
            v-for="tag in customTags"
            :key="tag"
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-ts-purple text-white"
          >
            {{ tag }}
            <text class="ml-1 cursor-pointer" @click="removeCustomTag(tag)">×</text>
          </view>
        </view>
      </view>

      <!-- 忌口筛选 -->
      <view v-if="activeFilter === 'avoid'" class="filter-content">
        <view class="text-sm font-medium text-gray-700 mb-3">忌口食材</view>
        <view class="flex flex-wrap gap-2 mb-4">
          <view
            v-for="option in avoidOptions"
            :key="option.value"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer border"
            :class="selectedAvoid.includes(option.value) 
              ? 'bg-red-500 text-white border-red-500' 
              : 'bg-gray-100 text-gray-700 border-gray-200'"
            @click="toggleAvoid(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
        <!-- 自定义输入 -->
        <view class="text-sm font-medium text-gray-700 mb-2">自定义忌口</view>
        <view class="flex items-center gap-2 mb-2">
          <input
            v-model="customAvoidInput"
            type="text"
            placeholder="输入忌口食材"
            class="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm"
            @confirm="addCustomAvoid"
          />
          <view
            class="px-3 py-1.5 rounded-lg text-sm cursor-pointer bg-red-500 text-white"
            @click="addCustomAvoid"
          >
            添加
          </view>
        </view>
        <!-- 已添加的自定义忌口 -->
        <view v-if="customAvoid.length > 0" class="flex flex-wrap gap-2">
          <view
            v-for="item in customAvoid"
            :key="item"
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-red-500 text-white"
          >
            {{ item }}
            <text class="ml-1 cursor-pointer" @click="removeCustomAvoid(item)">×</text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
        <view
          class="px-4 py-1.5 rounded-full text-sm cursor-pointer bg-gray-100 text-gray-600"
          @click="resetCurrentFilter"
        >
          重置
        </view>
        <view
          class="px-4 py-1.5 rounded-full text-sm cursor-pointer bg-ts-purple text-white"
          @click="applyFilter"
        >
          确定
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useFilter } from '../composables/use-filter';
import type { GetDishesRequest } from '@/types/api';

// 定义事件
const emit = defineEmits<{
  (e: 'filter-change', filter: GetDishesRequest['filter']): void;
}>();

// 使用 composable 获取所有状态和方法
const {
  // 配置选项
  filterOptions,
  priceOptions,
  ratingOptions,
  mealTimeOptions,
  meatOptions,
  tagOptions,
  avoidOptions,
  
  // 状态
  activeFilter,
  selectedPrice,
  selectedRating,
  selectedMealTime,
  selectedMeat,
  selectedTags,
  selectedAvoid,
  customPriceMin,
  customPriceMax,
  priceError,
  customRatingMin,
  customRatingMax,
  ratingError,
  customTagInput,
  customTags,
  customAvoidInput,
  customAvoid,
  tasteError,
  selectedSpicyMin,
  selectedSpicyMax,
  selectedSaltyMin,
  selectedSaltyMax,
  selectedSweetMin,
  selectedSweetMax,
  selectedOilyMin,
  selectedOilyMax,
  
  // 方法
  isTasteModified,
  getTasteRangeLabel,
  validatePriceInput,
  onCustomPriceInput,
  validateRatingInput,
  onCustomRatingInput,
  validateTasteInput,
  addCustomTag,
  removeCustomTag,
  addCustomAvoid,
  removeCustomAvoid,
  clearTasteError,
  onTasteSliderChange,
  hasActiveValue,
  toggleFilter,
  closeFilterPanel,
  selectPrice,
  selectRating,
  toggleMealTime,
  toggleMeat,
  toggleTag,
  toggleAvoid,
  resetCurrentFilter,
  applyFilter: applyFilterComposable,
  resetAllFilters,
} = useFilter();

// 包装 applyFilter 以触发事件
const applyFilter = () => {
  const filter = applyFilterComposable();
  if (filter !== null) {
    emit('filter-change', filter);
  }
};

// 包装 resetAllFilters 以触发事件
const resetAll = () => {
  resetAllFilters();
  emit('filter-change', {});
};

// 暴露方法供父组件调用
defineExpose({
  resetAllFilters: resetAll,
});
</script>

<style scoped>
.filter-scrollbar::-webkit-scrollbar {
  height: 0.5px;
}
.filter-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.12);
  border-radius: 999px;
}
.filter-scrollbar::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>

