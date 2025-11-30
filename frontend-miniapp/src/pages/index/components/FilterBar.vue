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
                @change="(e: any) => selectedSpicyMin = e.detail.value"
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
                @change="(e: any) => selectedSpicyMax = e.detail.value"
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
                @change="(e: any) => selectedSaltyMin = e.detail.value"
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
                @change="(e: any) => selectedSaltyMax = e.detail.value"
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
                @change="(e: any) => selectedSweetMin = e.detail.value"
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
                @change="(e: any) => selectedSweetMax = e.detail.value"
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
                @change="(e: any) => selectedOilyMin = e.detail.value"
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
                @change="(e: any) => selectedOilyMax = e.detail.value"
              />
              <text class="text-xs text-gray-600 w-8 text-center">{{ selectedOilyMax === 0 ? '不限' : selectedOilyMax }}</text>
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
const priceError = ref<string>('');

// 自定义评分输入
const customRatingMin = ref<string>('');
const customRatingMax = ref<string>('');
const ratingError = ref<string>('');

// 自定义标签
const customTagInput = ref<string>('');
const customTags = ref<string[]>([]);

// 自定义忌口
const customAvoidInput = ref<string>('');
const customAvoid = ref<string[]>([]);

// 口味范围 (0=未设置, 1-5=程度)
const selectedSpicyMin = ref<number>(0);
const selectedSpicyMax = ref<number>(0);
const selectedSaltyMin = ref<number>(0);
const selectedSaltyMax = ref<number>(0);
const selectedSweetMin = ref<number>(0);
const selectedSweetMax = ref<number>(0);
const selectedOilyMin = ref<number>(0);
const selectedOilyMax = ref<number>(0);

// 口味是否已修改（用于判断是否激活）
const isTasteModified = () => {
  return selectedSpicyMin.value > 0 || selectedSpicyMax.value > 0 ||
         selectedSaltyMin.value > 0 || selectedSaltyMax.value > 0 ||
         selectedSweetMin.value > 0 || selectedSweetMax.value > 0 ||
         selectedOilyMin.value > 0 || selectedOilyMax.value > 0;
};

// 获取口味范围标签描述 (0=未设置, 1-5=程度)
const getTasteRangeLabel = (type: string, minVal: number, maxVal: number): string => {
  const labels: Record<string, string[]> = {
    spicy: ['', '微辣', '中辣', '辣', '很辣', '超辣'],
    salty: ['', '微咸', '适中', '偏咸', '很咸', '超咸'],
    sweet: ['', '微甜', '适中', '偏甜', '很甜', '超甜'],
    oily: ['', '少油', '适中', '偏油', '较油', '很油'],
  };
  
  if (minVal === 0 && maxVal === 0) return '不限';
  
  const minLabel = minVal === 0 ? '不限' : (labels[type]?.[minVal] || String(minVal));
  const maxLabel = maxVal === 0 ? '不限' : (labels[type]?.[maxVal] || String(maxVal));
  
  if (minVal === 0) return `最高${maxLabel}`;
  if (maxVal === 0) return `最低${minLabel}`;
  return `${minLabel} - ${maxLabel}`;
};

// 验证自定义价格输入
const validatePriceInput = (): boolean => {
  priceError.value = '';
  const minStr = customPriceMin.value.trim();
  const maxStr = customPriceMax.value.trim();
  
  if (!minStr && !maxStr) return true; // 没有自定义输入时跳过验证
  
  const min = minStr ? Number(minStr) : null;
  const max = maxStr ? Number(maxStr) : null;
  
  if (minStr && (isNaN(min!) || min! < 0)) {
    priceError.value = '最低价必须是非负数字';
    return false;
  }
  if (maxStr && (isNaN(max!) || max! < 0)) {
    priceError.value = '最高价必须是非负数字';
    return false;
  }
  if (min !== null && max !== null && min > max) {
    priceError.value = '最低价不能大于最高价';
    return false;
  }
  return true;
};

// 自定义价格输入时清除预设选项
const onCustomPriceInput = () => {
  priceError.value = '';
  if (customPriceMin.value || customPriceMax.value) {
    selectedPrice.value = '';
  }
};

// 验证自定义评分输入
const validateRatingInput = (): boolean => {
  ratingError.value = '';
  const minStr = customRatingMin.value.trim();
  const maxStr = customRatingMax.value.trim();
  
  if (!minStr && !maxStr) return true;
  
  const min = minStr ? Number(minStr) : null;
  const max = maxStr ? Number(maxStr) : null;
  
  if (minStr && (isNaN(min!) || min! < 0 || min! > 5)) {
    ratingError.value = '最低分必须在 0-5 之间';
    return false;
  }
  if (maxStr && (isNaN(max!) || max! < 0 || max! > 5)) {
    ratingError.value = '最高分必须在 0-5 之间';
    return false;
  }
  if (min !== null && max !== null && min > max) {
    ratingError.value = '最低分不能大于最高分';
    return false;
  }
  return true;
};

// 自定义评分输入时清除预设选项
const onCustomRatingInput = () => {
  ratingError.value = '';
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
      return isTasteModified();
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
      priceError.value = '';
      break;
    case 'rating':
      selectedRating.value = 0;
      customRatingMin.value = '';
      customRatingMax.value = '';
      ratingError.value = '';
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
      selectedSpicyMin.value = 0;
      selectedSpicyMax.value = 0;
      selectedSaltyMin.value = 0;
      selectedSaltyMax.value = 0;
      selectedSweetMin.value = 0;
      selectedSweetMax.value = 0;
      selectedOilyMin.value = 0;
      selectedOilyMax.value = 0;
      break;
  }
};

// 构建并应用筛选条件
const applyFilter = () => {
  // 验证输入
  if (!validatePriceInput() || !validateRatingInput()) {
    return;
  }

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

  // 口味范围筛选（0表示未设置，只有设置了才添加到筛选条件）
  if (selectedSpicyMin.value > 0 || selectedSpicyMax.value > 0) {
    filter.spicyLevel = {
      min: selectedSpicyMin.value > 0 ? selectedSpicyMin.value : 1,
      max: selectedSpicyMax.value > 0 ? selectedSpicyMax.value : 5
    };
  }
  if (selectedSaltyMin.value > 0 || selectedSaltyMax.value > 0) {
    filter.saltiness = {
      min: selectedSaltyMin.value > 0 ? selectedSaltyMin.value : 1,
      max: selectedSaltyMax.value > 0 ? selectedSaltyMax.value : 5
    };
  }
  if (selectedSweetMin.value > 0 || selectedSweetMax.value > 0) {
    filter.sweetness = {
      min: selectedSweetMin.value > 0 ? selectedSweetMin.value : 1,
      max: selectedSweetMax.value > 0 ? selectedSweetMax.value : 5
    };
  }
  if (selectedOilyMin.value > 0 || selectedOilyMax.value > 0) {
    filter.oiliness = {
      min: selectedOilyMin.value > 0 ? selectedOilyMin.value : 1,
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
  priceError.value = '';
  selectedRating.value = 0;
  customRatingMin.value = '';
  customRatingMax.value = '';
  ratingError.value = '';
  selectedMealTime.value = [];
  selectedMeat.value = [];
  selectedTags.value = [];
  customTags.value = [];
  customTagInput.value = '';
  selectedAvoid.value = [];
  customAvoid.value = [];
  customAvoidInput.value = '';
  selectedSpicyMin.value = 0;
  selectedSpicyMax.value = 0;
  selectedSaltyMin.value = 0;
  selectedSaltyMax.value = 0;
  selectedSweetMin.value = 0;
  selectedSweetMax.value = 0;
  selectedOilyMin.value = 0;
  selectedOilyMax.value = 0;
  activeFilter.value = '';
  emit('filter-change', {});
};

defineExpose({
  resetAllFilters,
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

