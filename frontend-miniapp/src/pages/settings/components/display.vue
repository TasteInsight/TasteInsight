<template>
  <view class="w-full min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white p-4">
    <!-- 显示选项 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">显示选项</text>
      
      <!-- 显示卡路里 -->
      <view class="flex justify-between items-center py-3 border-b border-gray-100">
        <view>
          <text class="text-base text-gray-700 block">显示卡路里</text>
          <text class="text-xs text-gray-400 mt-1">在菜品列表中显示热量信息</text>
        </view>
        <switch 
          :checked="form.showCalories" 
          color="#82318E"
          @change="onShowCaloriesChange"
        />
      </view>

      <!-- 显示营养信息 -->
      <view class="flex justify-between items-center py-3">
        <view>
          <text class="text-base text-gray-700 block">显示营养信息</text>
          <text class="text-xs text-gray-400 mt-1">在菜品详情中显示营养成分</text>
        </view>
        <switch 
          :checked="form.showNutrition" 
          color="#82318E"
          @change="onShowNutritionChange"
        />
      </view>
    </view>

    <!-- 排序方式 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">默认排序方式</text>
      <picker 
        mode="selector" 
        :range="sortOptions" 
        :value="form.sortByIndex"
        @change="onSortChange"
      >
        <view class="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
          <text class="text-base text-gray-700">{{ sortOptions[form.sortByIndex] }}</text>
          <text class="text-gray-400">›</text>
        </view>
      </picker>
    </view>

    <!-- 保存按钮 -->
    <button 
      class="w-full py-4 bg-gradient-to-r from-ts-purple to-purple-600 text-white rounded-full text-base font-bold shadow-lg mt-6"
      :class="{ 'opacity-50': saving }"
      :disabled="saving"
      @click="handleSave"
    >
      <text>{{ saving ? '保存中...' : '保存设置' }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { useDisplay } from '../composables/use-display';

const {
  form,
  saving,
  sortOptions,
  onShowCaloriesChange,
  onShowNutritionChange,
  onSortChange,
  handleSave
} = useDisplay();
</script>
