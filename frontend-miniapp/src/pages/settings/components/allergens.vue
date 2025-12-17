<template>
  <view class="w-full min-h-screen p-4 bg-gray-50">
    <!-- 骨架屏：首次加载时显示 -->
    <AllergensSkeleton v-if="loading" />

    <template v-else>
    <!-- 说明文字 -->
    <view class="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
      <text class="text-sm text-blue-700 leading-relaxed">设置您的过敏原信息，系统会为您过滤包含这些成分的菜品。</text>
    </view>

    <!-- 过敏原输入 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">过敏原列表</text>
      <view class="relative">
        <textarea 
          v-model="form.allergens" 
          class="w-full p-3 border border-gray-200 rounded-lg text-base focus:border-ts-purple focus:ring-1 focus:ring-purple-100 transition-all"
          style="min-height:120px;"
          placeholder="请输入过敏原，多个过敏原用逗号分隔"
          maxlength="200"
        />
        <text class="absolute right-3 bottom-3 text-xs text-gray-400">{{ form.allergens.length }}/200</text>
      </view>
    </view>

    <!-- 常见过敏原快速选择 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">常见过敏原</text>
      <view class="flex flex-wrap gap-3">
        <view 
          v-for="item in commonAllergens" 
          :key="item"
          class="px-4 py-2 rounded-full text-sm border transition-all active:scale-95"
          :class="isSelected(item) ? 'bg-purple-50 border-ts-purple text-ts-purple font-medium' : 'bg-white border-gray-200 text-gray-600'"
          @click="toggleAllergen(item)"
        >
          <text>{{ item }}</text>
        </view>
      </view>
    </view>

    <!-- 保存按钮 -->
    <button 
      class="w-full py-3.5 bg-ts-purple text-white rounded-full text-base font-semibold shadow-md active:bg-purple-800 active:scale-[0.99] transition-all mt-8"
      :class="{ 'opacity-70': saving }"
      :disabled="saving"
      @click="handleSave"
    >
      <text>{{ saving ? '保存中...' : '保存设置' }}</text>
    </button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { useAllergens } from '../composables/use-allergens';
import { AllergensSkeleton } from '@/components/skeleton';

const { form, saving, loading, commonAllergens, isSelected, toggleAllergen, handleSave } = useAllergens();
</script>
