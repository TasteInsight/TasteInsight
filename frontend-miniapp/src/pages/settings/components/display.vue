<template>
  <view class="w-full min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white p-4" style="max-width: 375px;">
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
import { reactive, ref, onMounted } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import type { UserProfileUpdateRequest, UserPreference } from '@/types/api';

const userStore = useUserStore();
const saving = ref(false);
const loading = ref(true);
const form = reactive({
  showCalories: true,
  showNutrition: true,
  sortByIndex: 0
});

const sortOptions = ['推荐排序', '热度排序', '最新上架', '价格从低到高', '价格从高到低'];
const sortByValues = ['rating', 'popularity', 'newest', 'price_low', 'price_high'];

/**
 * 加载用户信息
 */
onMounted(async () => {
  try {
    await userStore.fetchProfileAction();
    const userInfo = userStore.userInfo;
    if (userInfo && userInfo.preferences && userInfo.preferences.displaySettings) {
      const display = userInfo.preferences.displaySettings;
      form.showCalories = display.showCalories ?? true;
      form.showNutrition = display.showNutrition ?? true;
      if (display.sortBy) {
        const index = sortByValues.indexOf(display.sortBy);
        form.sortByIndex = index >= 0 ? index : 0;
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  } finally {
    loading.value = false;
  }
});

/**
 * 事件处理：兼容不同平台的 change 事件结构
 */
function onShowCaloriesChange(e: any) {
  form.showCalories = e && typeof e === 'object' && 'detail' in e ? !!e.detail.value : !!e;
}

function onShowNutritionChange(e: any) {
  form.showNutrition = e && typeof e === 'object' && 'detail' in e ? !!e.detail.value : !!e;
}

function onSortChange(e: any) {
  const val = e && typeof e === 'object' && 'detail' in e ? e.detail.value : e;
  form.sortByIndex = Number(val) || 0;
}

/**
 * 保存设置
 */
async function handleSave() {
  saving.value = true;
  try {
    const preferences: Partial<UserPreference> = {
      displaySettings: {
        showCalories: form.showCalories,
        showNutrition: form.showNutrition,
        sortBy: sortByValues[form.sortByIndex] as any
      }
    };

    const payload: UserProfileUpdateRequest = {
      preferences
    };

    const response = await updateUserProfile(payload);
    if (response.code !== 200 || !response.data) {
      throw new Error(response.message || '保存失败');
    }

    userStore.updateLocalUserInfo(response.data);
    
    uni.showToast({
      title: '保存成功',
      icon: 'success'
    });
    
    setTimeout(() => {
      uni.navigateBack();
    }, 1000);
  } catch (error) {
    console.error('保存失败:', error);
    const message = error instanceof Error ? error.message : '保存失败';
    uni.showToast({
      title: message,
      icon: 'none'
    });
  } finally {
    saving.value = false;
  }
}
</script>
