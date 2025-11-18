<template>
  <view class="w-full min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white p-4" style="max-width: 375px;">
    <!-- 口味偏好 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">口味偏好</text>

      <!-- 辣度 -->
      <view class="mb-6">
        <view class="flex justify-between items-center mb-2">
          <text class="text-base text-gray-700">辣度</text>
          <text class="text-sm text-ts-purple font-medium">{{ spicinessLabels[form.spiciness] }}</text>
        </view>
        <slider 
          :value="form.spiciness" 
          min="0" 
          max="4" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#E5E7EB"
          block-size="20"
          @change="(e: any) => form.spiciness = e.detail.value"
        />
        <view class="flex justify-between mt-1">
          <text class="text-xs text-gray-400">不辣</text>
          <text class="text-xs text-gray-400">微辣</text>
          <text class="text-xs text-gray-400">中辣</text>
          <text class="text-xs text-gray-400">重辣</text>
          <text class="text-xs text-gray-400">特辣</text>
        </view>
      </view>

      <!-- 甜度 -->
      <view class="mb-6">
        <view class="flex justify-between items-center mb-2">
          <text class="text-base text-gray-700">甜度</text>
          <text class="text-sm text-ts-purple font-medium">{{ tasteLabels[form.sweetness] }}</text>
        </view>
        <slider 
          :value="form.sweetness" 
          min="0" 
          max="4" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#E5E7EB"
          block-size="20"
          @change="(e: any) => form.sweetness = e.detail.value"
        />
        <view class="flex justify-between mt-1">
          <text class="text-xs text-gray-400">清淡</text>
          <text class="text-xs text-gray-400">适中</text>
          <text class="text-xs text-gray-400">偏甜</text>
        </view>
      </view>

      <!-- 咸度 -->
      <view class="mb-6">
        <view class="flex justify-between items-center mb-2">
          <text class="text-base text-gray-700">咸度</text>
          <text class="text-sm text-ts-purple font-medium">{{ tasteLabels[form.saltiness] }}</text>
        </view>
        <slider 
          :value="form.saltiness" 
          min="0" 
          max="4" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#E5E7EB"
          block-size="20"
          @change="(e: any) => form.saltiness = e.detail.value"
        />
        <view class="flex justify-between mt-1">
          <text class="text-xs text-gray-400">清淡</text>
          <text class="text-xs text-gray-400">适中</text>
          <text class="text-xs text-gray-400">偏咸</text>
        </view>
      </view>

      <!-- 油腻度 -->
      <view>
        <view class="flex justify-between items-center mb-2">
          <text class="text-base text-gray-700">油腻度</text>
          <text class="text-sm text-ts-purple font-medium">{{ tasteLabels[form.oiliness] }}</text>
        </view>
        <slider 
          :value="form.oiliness" 
          min="0" 
          max="4" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#E5E7EB"
          block-size="20"
          @change="(e: any) => form.oiliness = e.detail.value"
        />
        <view class="flex justify-between mt-1">
          <text class="text-xs text-gray-400">清淡</text>
          <text class="text-xs text-gray-400">适中</text>
          <text class="text-xs text-gray-400">重油</text>
        </view>
      </view>
    </view>

    <!-- 喜好食材 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">喜好食材</text>
      <textarea 
        v-model="form.favoriteIngredients" 
        class="w-full p-3 border border-gray-200 rounded-lg text-base min-h-[100px]"
        placeholder="请输入您喜欢的食材，多个食材用逗号分隔&#10;例如：鸡肉, 牛肉, 西兰花, 番茄"
        maxlength="200"
      />
      <text class="text-xs text-gray-400 mt-2 block">{{ form.favoriteIngredients.length }}/200</text>
    </view>

    <!-- 分量偏好 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">分量偏好</text>
      <picker :value="Object.values(portionLabels).indexOf(portionLabels[form.portionSize])" :range="Object.values(portionLabels)" @change="(e: any) => form.portionSize = reversePortionLabels[Object.values(portionLabels)[e.detail.value]]">
        <view class="picker">当前选择: {{ portionLabels[form.portionSize] }}</view>
      </picker>
    </view>

    <!-- 肉类偏好 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">肉类偏好</text>
      <textarea 
        v-model="form.meatPreferences" 
        class="w-full p-3 border border-gray-200 rounded-lg text-base min-h-[100px]"
        placeholder="请输入您喜欢的肉类，多个肉类用逗号分隔，例如：鸡肉, 牛肉, 羊肉"
        maxlength="200"
      />
    </view>

    <!-- 价格偏好范围 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">价格偏好范围</text>
      <view class="flex items-center space-x-4 mt-4 mb-4">
        <input 
          v-model.number="form.priceRange.min" 
          type="number" 
          class="w-1/2 p-3 border border-gray-200 rounded-lg text-base" 
          placeholder="最低价格"
          min="0"
        />
        <input 
          v-model.number="form.priceRange.max" 
          type="number" 
          class="w-1/2 p-3 border border-gray-200 rounded-lg text-base" 
          placeholder="最高价格"
          min="0"
        />
      </view>
      <text class="text-sm text-gray-500 mt-2 block">请输入价格范围，单位为元</text>
    </view>

    <!-- 食堂偏好 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">食堂偏好</text>
      <textarea 
        v-model="form.canteenPreferences" 
        class="w-full p-3 border border-gray-200 rounded-lg text-base min-h-[100px]"
        placeholder="请输入您喜欢的食堂，多个食堂用逗号分隔，例如：一食堂, 二食堂"
        maxlength="200"
      />
    </view>

    <!-- 不喜欢的食材 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">不喜欢的食材</text>
      <textarea 
        v-model="form.avoidIngredients" 
        class="w-full p-3 border border-gray-200 rounded-lg text-base min-h-[100px]"
        placeholder="请输入您不喜欢的食材，多个食材用逗号分隔，例如：香菜, 洋葱"
        maxlength="200"
      />
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
  spiciness: 2,
  sweetness: 2,
  saltiness: 2,
  oiliness: 2,
  portionSize: 'medium' as 'small' | 'medium' | 'large',
  meatPreferences: '',
  priceRange: { min: 20, max: 100 },
  canteenPreferences: '',
  avoidIngredients: '',
  favoriteIngredients: ''
});

const tasteLabels = ['很淡', '清淡', '适中', '偏重', '很重'];
const spicinessLabels = ['不辣', '微辣', '中辣', '重辣', '特辣'];
const portionLabels: Record<'small' | 'medium' | 'large', string> = {
  small: '小份',
  medium: '中份',
  large: '大份'
};
const reversePortionLabels: Record<string, 'small' | 'medium' | 'large'> = {
  '小份': 'small',
  '中份': 'medium',
  '大份': 'large'
};

/**
 * 加载用户信息
 */
onMounted(async () => {
  try {
    await userStore.fetchProfileAction();
    const userInfo = userStore.userInfo;
    if (userInfo && userInfo.preferences) {
      const pref = userInfo.preferences;
      if (pref.tastePreferences) {
        form.spiciness = pref.tastePreferences.spiciness ?? 2;
        form.sweetness = pref.tastePreferences.sweetness ?? 2;
        form.saltiness = pref.tastePreferences.saltiness ?? 2;
        form.oiliness = pref.tastePreferences.oiliness ?? 2;
      }
      form.portionSize = pref.portionSize ?? 'medium';
      form.meatPreferences = (pref.meatPreference ?? []).join(', ');
      form.priceRange = pref.priceRange ?? { min: 20, max: 100 };
      form.canteenPreferences = (pref.canteenPreferences ?? []).join(', ');
      form.favoriteIngredients = (pref.favoriteIngredients ?? []).join(', ');
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  } finally {
    loading.value = false;
  }
});

/**
 * 解析列表
 */
function parseList(text: string): string[] {
  return text
    .split(/[,，;；\n\r\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 保存设置
 */
async function handleSave() {
  saving.value = true;
  try {
    const preferences: Partial<UserPreference> = {
      tastePreferences: {
        spiciness: form.spiciness,
        sweetness: form.sweetness,
        saltiness: form.saltiness,
        oiliness: form.oiliness
      },
      portionSize: form.portionSize,
      meatPreference: parseList(form.meatPreferences),
      priceRange: form.priceRange,
      canteenPreferences: parseList(form.canteenPreferences),
      favoriteIngredients: parseList(form.favoriteIngredients)
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
