<!-- @/pages/index/components/FilterBar.vue -->
<template>
  <view class="filter-bar">
    <!-- 筛选标签栏 -->
    <view class="flex flex-wrap py-3 gap-2">
      <view
        v-for="filter in filterOptions"
        :key="filter.key"
        class="inline-flex items-center border rounded-full h-8 px-3 text-sm cursor-pointer transition-all"
        :class="(activeFilter === filter.key || hasActiveValue(filter.key))
          ? 'bg-ts-purple text-white border-ts-purple' 
          : 'bg-white text-gray-700 border-gray-300'"
        @click="toggleFilter(filter.key)"
      >
        <text>{{ filter.label }}</text>
        <text v-if="hasActiveValue(filter.key)" class="ml-1 text-xs">✓</text>
      </view>
    </view>

    <!-- 点击遮罩关闭筛选面板 -->
    <view
      v-if="activeFilter"
      class="filter-overlay"
      @tap="closeFilterPanel"
    ></view>

    <!-- 筛选面板 -->
    <view v-if="activeFilter" class="filter-panel bg-white rounded-lg shadow-lg p-4 mb-4">
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
        <!-- 辣度 -->
        <view class="mb-4">
          <view class="flex justify-between items-center mb-2">
            <text class="text-sm font-medium text-gray-700">辣度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('spicy', selectedSpicyMin, selectedSpicyMax) }}</text>
          </view>
          <view class="flex items-center gap-2 mb-2">
            <text class="text-xs text-gray-500 w-8">最小:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedSpicyMin === level - 1
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedSpicyMin = selectedSpicyMin === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
          <view class="flex items-center gap-2">
            <text class="text-xs text-gray-500 w-8">最大:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedSpicyMax === level - 1
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedSpicyMax = selectedSpicyMax === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
        </view>

        <!-- 咸度 -->
        <view class="mb-4">
          <view class="flex justify-between items-center mb-2">
            <text class="text-sm font-medium text-gray-700">咸度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('salty', selectedSaltyMin, selectedSaltyMax) }}</text>
          </view>
          <view class="flex items-center gap-2 mb-2">
            <text class="text-xs text-gray-500 w-8">最小:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedSaltyMin === level - 1
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedSaltyMin = selectedSaltyMin === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
          <view class="flex items-center gap-2">
            <text class="text-xs text-gray-500 w-8">最大:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedSaltyMax === level - 1
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedSaltyMax = selectedSaltyMax === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
        </view>

        <!-- 甜度 -->
        <view class="mb-4">
          <view class="flex justify-between items-center mb-2">
            <text class="text-sm font-medium text-gray-700">甜度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('sweet', selectedSweetMin, selectedSweetMax) }}</text>
          </view>
          <view class="flex items-center gap-2 mb-2">
            <text class="text-xs text-gray-500 w-8">最小:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedSweetMin === level - 1
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedSweetMin = selectedSweetMin === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
          <view class="flex items-center gap-2">
            <text class="text-xs text-gray-500 w-8">最大:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedSweetMax === level - 1
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedSweetMax = selectedSweetMax === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
        </view>

        <!-- 油腻度 -->
        <view>
          <view class="flex justify-between items-center mb-2">
            <text class="text-sm font-medium text-gray-700">油腻度范围</text>
            <text class="text-xs text-gray-500">{{ getTasteRangeLabel('oily', selectedOilyMin, selectedOilyMax) }}</text>
          </view>
          <view class="flex items-center gap-2 mb-2">
            <text class="text-xs text-gray-500 w-8">最小:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedOilyMin === level - 1
                  ? 'bg-yellow-600 text-white border-yellow-600'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedOilyMin = selectedOilyMin === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
          <view class="flex items-center gap-2">
            <text class="text-xs text-gray-500 w-8">最大:</text>
            <view class="flex gap-1 flex-1">
              <view
                v-for="level in 6"
                :key="level - 1"
                class="flex-1 h-8 rounded flex items-center justify-center text-xs cursor-pointer border"
                :class="selectedOilyMax === level - 1
                  ? 'bg-yellow-600 text-white border-yellow-600'
                  : 'bg-gray-100 text-gray-600 border-gray-200'"
                @click="selectedOilyMax = selectedOilyMax === level - 1 ? -1 : level - 1"
              >
                {{ level - 1 === 0 ? '不限' : level - 1 }}
              </view>
            </view>
          </view>
        </view>
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
import { ref } from 'vue';
import type { GetDishesRequest } from '@/types/api';

// 定义事件
const emit = defineEmits<{
  (e: 'filter-change', filter: GetDishesRequest['filter']): void;
}>();

// 筛选选项配置
const filterOptions = [
  { key: 'taste', label: '口味' },
  { key: 'price', label: '价格' },
  { key: 'rating', label: '评分' },
  { key: 'mealTime', label: '时段' },
  { key: 'meat', label: '荤素' },
  { key: 'tag', label: '标签' },
  { key: 'avoid', label: '忌口' },
];

// 价格选项
const priceOptions = [
  { label: '不限', value: '' },
  { label: '10元以下', value: '0-10' },
  { label: '10-15元', value: '10-15' },
  { label: '15-20元', value: '15-20' },
  { label: '20元以上', value: '20-999' },
];

// 评分选项
const ratingOptions = [
  { label: '不限', value: 0 },
  { label: '4.5分以上', value: 4.5 },
  { label: '4.0分以上', value: 4.0 },
  { label: '3.5分以上', value: 3.5 },
];

// 用餐时段选项
const mealTimeOptions = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '夜宵', value: 'nightsnack' },
];

// 荤素选项
const meatOptions = [
  { label: '纯素', value: '素' },
  { label: '纯荤', value: '荤' },
  { label: '荤素搭配', value: '荤素' },
  { label: '海鲜', value: '海鲜' },
];

// 标签选项
const tagOptions = [
  { label: '招牌', value: '招牌' },
  { label: '新品', value: '新品' },
  { label: '热销', value: '热销' },
  { label: '特价', value: '特价' },
  { label: '清真', value: '清真' },
  { label: '健康', value: '健康' },
];

// 忌口选项
const avoidOptions = [
  { label: '葱', value: '葱' },
  { label: '姜', value: '姜' },
  { label: '蒜', value: '蒜' },
  { label: '香菜', value: '香菜' },
  { label: '辣椒', value: '辣椒' },
  { label: '花生', value: '花生' },
  { label: '牛奶', value: '牛奶' },
  { label: '鸡蛋', value: '鸡蛋' },
];

// 当前展开的筛选项
const activeFilter = ref<string>('');

// 各筛选项的选中状态
const selectedPrice = ref<string>('');
const selectedRating = ref<number>(0);
const selectedMealTime = ref<string[]>([]);
const selectedMeat = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const selectedAvoid = ref<string[]>([]);

// 自定义价格输入
const customPriceMin = ref<string>('');
const customPriceMax = ref<string>('');

// 自定义评分输入
const customRatingMin = ref<string>('');
const customRatingMax = ref<string>('');

// 自定义标签
const customTagInput = ref<string>('');
const customTags = ref<string[]>([]);

// 自定义忌口
const customAvoidInput = ref<string>('');
const customAvoid = ref<string[]>([]);

// 口味范围 (-1 表示不限，0表示未设置/不限)
const selectedSpicyMin = ref<number>(-1);
const selectedSpicyMax = ref<number>(-1);
const selectedSaltyMin = ref<number>(-1);
const selectedSaltyMax = ref<number>(-1);
const selectedSweetMin = ref<number>(-1);
const selectedSweetMax = ref<number>(-1);
const selectedOilyMin = ref<number>(-1);
const selectedOilyMax = ref<number>(-1);

// 获取口味范围标签描述
const getTasteRangeLabel = (type: string, minVal: number, maxVal: number): string => {
  const labels: Record<string, string[]> = {
    spicy: ['','不辣', '微辣', '中辣', '辣', '很辣'],
    salty: ['','清淡', '微咸', '适中', '偏咸', '很咸'],
    sweet: ['','不甜', '微甜', '适中', '偏甜', '很甜'],
    oily: ['','清爽', '少油', '适中', '偏油', '较油'],
  };
  
  if (minVal <= 0 && maxVal <= 0) return '不限';
  
  const minLabel = minVal <= 0 ? '不限' : (labels[type]?.[minVal] || String(minVal));
  const maxLabel = maxVal <= 0 ? '不限' : (labels[type]?.[maxVal] || String(maxVal));
  
  if (minVal <= 0) return `最高${maxLabel}`;
  if (maxVal <= 0) return `最低${minLabel}`;
  return `${minLabel} - ${maxLabel}`;
};

// 自定义价格输入时清除预设选项
const onCustomPriceInput = () => {
  if (customPriceMin.value || customPriceMax.value) {
    selectedPrice.value = '';
  }
};

// 自定义评分输入时清除预设选项
const onCustomRatingInput = () => {
  if (customRatingMin.value || customRatingMax.value) {
    selectedRating.value = 0;
  }
};

// 添加自定义标签
const addCustomTag = () => {
  const tag = customTagInput.value.trim();
  if (tag && !customTags.value.includes(tag) && !selectedTags.value.includes(tag)) {
    customTags.value.push(tag);
    customTagInput.value = '';
  }
};

// 移除自定义标签
const removeCustomTag = (tag: string) => {
  const index = customTags.value.indexOf(tag);
  if (index > -1) {
    customTags.value.splice(index, 1);
  }
};

// 添加自定义忌口
const addCustomAvoid = () => {
  const item = customAvoidInput.value.trim();
  if (item && !customAvoid.value.includes(item) && !selectedAvoid.value.includes(item)) {
    customAvoid.value.push(item);
    customAvoidInput.value = '';
  }
};

// 移除自定义忌口
const removeCustomAvoid = (item: string) => {
  const index = customAvoid.value.indexOf(item);
  if (index > -1) {
    customAvoid.value.splice(index, 1);
  }
};

// 检查某个筛选项是否有值
const hasActiveValue = (key: string): boolean => {
  switch (key) {
    case 'price':
      return selectedPrice.value !== '' || customPriceMin.value !== '' || customPriceMax.value !== '';
    case 'rating':
      return selectedRating.value > 0 || customRatingMin.value !== '' || customRatingMax.value !== '';
    case 'mealTime':
      return selectedMealTime.value.length > 0;
    case 'meat':
      return selectedMeat.value.length > 0;
    case 'tag':
      return selectedTags.value.length > 0 || customTags.value.length > 0;
    case 'avoid':
      return selectedAvoid.value.length > 0 || customAvoid.value.length > 0;
    case 'taste':
      return selectedSpicyMin.value > 0 || selectedSpicyMax.value > 0 ||
             selectedSaltyMin.value > 0 || selectedSaltyMax.value > 0 ||
             selectedSweetMin.value > 0 || selectedSweetMax.value > 0 ||
             selectedOilyMin.value > 0 || selectedOilyMax.value > 0;
    default:
      return false;
  }
};

// 切换筛选面板
const toggleFilter = (key: string) => {
  activeFilter.value = activeFilter.value === key ? '' : key;
};

const closeFilterPanel = () => {
  activeFilter.value = '';
};

// 选择价格
const selectPrice = (value: string) => {
  selectedPrice.value = selectedPrice.value === value ? '' : value;
  // 选择预设时清除自定义输入
  if (value) {
    customPriceMin.value = '';
    customPriceMax.value = '';
  }
};

// 选择评分
const selectRating = (value: number) => {
  selectedRating.value = selectedRating.value === value ? 0 : value;
  // 选择预设时清除自定义输入
  if (value) {
    customRatingMin.value = '';
    customRatingMax.value = '';
  }
};

// 切换用餐时段
const toggleMealTime = (value: string) => {
  const index = selectedMealTime.value.indexOf(value);
  if (index === -1) {
    selectedMealTime.value.push(value);
  } else {
    selectedMealTime.value.splice(index, 1);
  }
};

// 切换荤素
const toggleMeat = (value: string) => {
  const index = selectedMeat.value.indexOf(value);
  if (index === -1) {
    selectedMeat.value.push(value);
  } else {
    selectedMeat.value.splice(index, 1);
  }
};

// 切换标签
const toggleTag = (value: string) => {
  const index = selectedTags.value.indexOf(value);
  if (index === -1) {
    selectedTags.value.push(value);
  } else {
    selectedTags.value.splice(index, 1);
  }
};

// 切换忌口
const toggleAvoid = (value: string) => {
  const index = selectedAvoid.value.indexOf(value);
  if (index === -1) {
    selectedAvoid.value.push(value);
  } else {
    selectedAvoid.value.splice(index, 1);
  }
};

// 重置当前筛选项
const resetCurrentFilter = () => {
  switch (activeFilter.value) {
    case 'price':
      selectedPrice.value = '';
      customPriceMin.value = '';
      customPriceMax.value = '';
      break;
    case 'rating':
      selectedRating.value = 0;
      customRatingMin.value = '';
      customRatingMax.value = '';
      break;
    case 'mealTime':
      selectedMealTime.value = [];
      break;
    case 'meat':
      selectedMeat.value = [];
      break;
    case 'tag':
      selectedTags.value = [];
      customTags.value = [];
      customTagInput.value = '';
      break;
    case 'avoid':
      selectedAvoid.value = [];
      customAvoid.value = [];
      customAvoidInput.value = '';
      break;
    case 'taste':
      selectedSpicyMin.value = -1;
      selectedSpicyMax.value = -1;
      selectedSaltyMin.value = -1;
      selectedSaltyMax.value = -1;
      selectedSweetMin.value = -1;
      selectedSweetMax.value = -1;
      selectedOilyMin.value = -1;
      selectedOilyMax.value = -1;
      break;
  }
};

// 构建并应用筛选条件
const applyFilter = () => {
  const filter: GetDishesRequest['filter'] = {};

  // 价格筛选
  if (customPriceMin.value || customPriceMax.value) {
    // 优先使用自定义输入
    const min = customPriceMin.value ? Number(customPriceMin.value) : 0;
    const max = customPriceMax.value ? Number(customPriceMax.value) : 999;
    filter.price = { min, max };
  } else if (selectedPrice.value) {
    const [min, max] = selectedPrice.value.split('-').map(Number);
    filter.price = { min, max };
  }

  // 评分筛选
  if (customRatingMin.value || customRatingMax.value) {
    // 优先使用自定义输入
    const min = customRatingMin.value ? Number(customRatingMin.value) : 0;
    const max = customRatingMax.value ? Number(customRatingMax.value) : 5;
    filter.rating = { min, max };
  } else if (selectedRating.value > 0) {
    filter.rating = { min: selectedRating.value, max: 5 };
  }

  // 用餐时段筛选
  if (selectedMealTime.value.length > 0) {
    filter.mealTime = [...selectedMealTime.value];
  }

  // 荤素筛选
  if (selectedMeat.value.length > 0) {
    filter.meatPreference = [...selectedMeat.value];
  }

  // 标签筛选 (合并预设和自定义)
  const allTags = [...selectedTags.value, ...customTags.value];
  if (allTags.length > 0) {
    filter.tag = allTags;
  }

  // 忌口筛选 (合并预设和自定义)
  const allAvoid = [...selectedAvoid.value, ...customAvoid.value];
  if (allAvoid.length > 0) {
    filter.avoidIngredients = allAvoid;
  }

  // 口味范围筛选
  if (selectedSpicyMin.value > 0 || selectedSpicyMax.value > 0) {
    filter.spicyLevel = {
      min: selectedSpicyMin.value > 0 ? selectedSpicyMin.value : 0,
      max: selectedSpicyMax.value > 0 ? selectedSpicyMax.value : 5
    };
  }
  if (selectedSaltyMin.value > 0 || selectedSaltyMax.value > 0) {
    filter.saltiness = {
      min: selectedSaltyMin.value > 0 ? selectedSaltyMin.value : 0,
      max: selectedSaltyMax.value > 0 ? selectedSaltyMax.value : 5
    };
  }
  if (selectedSweetMin.value > 0 || selectedSweetMax.value > 0) {
    filter.sweetness = {
      min: selectedSweetMin.value > 0 ? selectedSweetMin.value : 0,
      max: selectedSweetMax.value > 0 ? selectedSweetMax.value : 5
    };
  }
  if (selectedOilyMin.value > 0 || selectedOilyMax.value > 0) {
    filter.oiliness = {
      min: selectedOilyMin.value > 0 ? selectedOilyMin.value : 0,
      max: selectedOilyMax.value > 0 ? selectedOilyMax.value : 5
    };
  }

  // 关闭面板并触发事件
  activeFilter.value = '';
  emit('filter-change', filter);
};

// 暴露重置方法供父组件调用
const resetAllFilters = () => {
  selectedPrice.value = '';
  customPriceMin.value = '';
  customPriceMax.value = '';
  selectedRating.value = 0;
  customRatingMin.value = '';
  customRatingMax.value = '';
  selectedMealTime.value = [];
  selectedMeat.value = [];
  selectedTags.value = [];
  customTags.value = [];
  customTagInput.value = '';
  selectedAvoid.value = [];
  customAvoid.value = [];
  customAvoidInput.value = '';
  selectedSpicyMin.value = -1;
  selectedSpicyMax.value = -1;
  selectedSaltyMin.value = -1;
  selectedSaltyMax.value = -1;
  selectedSweetMin.value = -1;
  selectedSweetMax.value = -1;
  selectedOilyMin.value = -1;
  selectedOilyMax.value = -1;
  activeFilter.value = '';
  emit('filter-change', {});
};

defineExpose({
  resetAllFilters,
});
</script>

<style scoped>
.filter-bar {
  position: relative;
}

.filter-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.15);
  z-index: 5;
}

.filter-panel {
  position: relative;
  z-index: 10;
  border: 1px solid #e5e7eb;
}
</style>