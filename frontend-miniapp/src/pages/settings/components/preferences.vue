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
          <text class="text-xs text-gray-400">未设置</text>
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
          <text class="text-xs text-gray-400">未设置</text>
          <text class="text-xs text-gray-400">清淡</text>
          <text class="text-xs text-gray-400">适中</text>
          <text class="text-xs text-gray-400">偏甜</text>
          <text class="text-xs text-gray-400">很甜</text>
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
          <text class="text-xs text-gray-400">未设置</text>
          <text class="text-xs text-gray-400">清淡</text>
          <text class="text-xs text-gray-400">适中</text>
          <text class="text-xs text-gray-400">偏咸</text>
          <text class="text-xs text-gray-400">很咸</text>
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
          <text class="text-xs text-gray-400">未设置</text>
          <text class="text-xs text-gray-400">清淡</text>
          <text class="text-xs text-gray-400">适中</text>
          <text class="text-xs text-gray-400">偏油</text>
          <text class="text-xs text-gray-400">重油</text>
        </view>
      </view>
    </view>

    <!-- 喜好食材 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">喜好食材</text>
      <view class="flex items-center space-x-2">
        <input 
          v-model="newFavoriteIngredient" 
          class="flex-1 p-3 border border-gray-200 rounded-lg text-base"
          placeholder="请输入食材名称"
          maxlength="20"
          @confirm="addFavoriteIngredient"
        />
        <button 
          class="px-4 py-3 bg-ts-purple text-white rounded-lg text-sm font-medium"
          @click="addFavoriteIngredient"
        >
          添加
        </button>
      </view>
      <view class="flex flex-wrap gap-2 mt-4" v-if="form.favoriteIngredients.length > 0">
        <view 
          v-for="(item, index) in form.favoriteIngredients" 
          :key="index"
          class="px-3 py-1 bg-purple-50 text-ts-purple rounded-full text-sm flex items-center space-x-1"
        >
          <text>{{ item }}</text>
          <text class="ml-1 text-red-500" @click="removeFavoriteIngredient(index)">×</text>
        </view>
      </view>
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
      <view class="flex items-center space-x-2">
        <input 
          v-model="newMeatPreference" 
          class="flex-1 p-3 border border-gray-200 rounded-lg text-base"
          placeholder="请输入肉类名称"
          maxlength="20"
          @confirm="addMeatPreference"
        />
        <button 
          class="px-4 py-3 bg-ts-purple text-white rounded-lg text-sm font-medium"
          @click="addMeatPreference"
        >
          添加
        </button>
      </view>
      <view class="flex flex-wrap gap-2 mt-4" v-if="form.meatPreferences.length > 0">
        <view 
          v-for="(item, index) in form.meatPreferences" 
          :key="index"
          class="px-3 py-1 bg-purple-50 text-ts-purple rounded-full text-sm flex items-center space-x-1"
        >
          <text>{{ item }}</text>
          <text class="ml-1 text-red-500" @click="removeMeatPreference(index)">×</text>
        </view>
      </view>
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
          @blur="validatePriceRange"
        />
        <input 
          v-model.number="form.priceRange.max" 
          type="number" 
          class="w-1/2 p-3 border border-gray-200 rounded-lg text-base" 
          placeholder="最高价格"
          min="0"
          @blur="validatePriceRange"
        />
      </view>
      <text class="text-sm text-gray-500 mt-2 block">请输入价格范围，单位为元</text>
    </view>

    <!-- 食堂偏好 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">食堂偏好</text>
      <view class="flex items-center space-x-2">
        <input 
          v-model="newCanteenPreference" 
          class="flex-1 p-3 border border-gray-200 rounded-lg text-base"
          placeholder="请输入食堂名称"
          maxlength="20"
          @confirm="addCanteenPreference"
        />
        <button 
          class="px-4 py-3 bg-ts-purple text-white rounded-lg text-sm font-medium"
          @click="addCanteenPreference"
        >
          添加
        </button>
      </view>
      <view class="flex flex-wrap gap-2 mt-4" v-if="form.canteenPreferences.length > 0">
        <view 
          v-for="(item, index) in form.canteenPreferences" 
          :key="index"
          class="px-3 py-1 bg-purple-50 text-ts-purple rounded-full text-sm flex items-center space-x-1"
        >
          <text>{{ item }}</text>
          <text class="ml-1 text-red-500" @click="removeCanteenPreference(index)">×</text>
        </view>
      </view>
    </view>

    <!-- 不喜欢的食材 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">不喜欢的食材</text>
      <view class="flex items-center space-x-2">
        <input 
          v-model="newAvoidIngredient" 
          class="flex-1 p-3 border border-gray-200 rounded-lg text-base"
          placeholder="请输入食材名称"
          maxlength="20"
          @confirm="addAvoidIngredient"
        />
        <button 
          class="px-4 py-3 bg-ts-purple text-white rounded-lg text-sm font-medium"
          @click="addAvoidIngredient"
        >
          添加
        </button>
      </view>
      <view class="flex flex-wrap gap-2 mt-4" v-if="form.avoidIngredients.length > 0">
        <view 
          v-for="(item, index) in form.avoidIngredients" 
          :key="index"
          class="px-3 py-1 bg-purple-50 text-ts-purple rounded-full text-sm flex items-center space-x-1"
        >
          <text>{{ item }}</text>
          <text class="ml-1 text-red-500" @click="removeAvoidIngredient(index)">×</text>
        </view>
      </view>
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
  spiciness: 0,
  sweetness: 0,
  saltiness: 0,
  oiliness: 0,
  portionSize: 'medium' as 'small' | 'medium' | 'large',
  meatPreferences: [] as string[],
  priceRange: { min: 20, max: 100 },
  canteenPreferences: [] as string[],
  avoidIngredients: [] as string[],
  favoriteIngredients: [] as string[]
});

const newFavoriteIngredient = ref('');
const newMeatPreference = ref('');
const newCanteenPreference = ref('');
const newAvoidIngredient = ref('');

const tasteLabels = ['未设置', '清淡', '适中', '偏重', '很重'];
const spicinessLabels = ['未设置', '微辣', '中辣', '重辣', '特辣'];
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
        form.spiciness = pref.tastePreferences.spiciness ?? 0;
        form.sweetness = pref.tastePreferences.sweetness ?? 0;
        form.saltiness = pref.tastePreferences.saltiness ?? 0;
        form.oiliness = pref.tastePreferences.oiliness ?? 0;
      }
      form.portionSize = pref.portionSize ?? 'medium';
      form.meatPreferences = pref.meatPreference ?? [];
      form.priceRange = pref.priceRange ?? { min: 20, max: 100 };
      form.canteenPreferences = pref.canteenPreferences ?? [];
      form.avoidIngredients = pref.avoidIngredients ?? [];
      form.favoriteIngredients = pref.favoriteIngredients ?? [];
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  } finally {
    loading.value = false;
  }
});

/**
 * 验证价格范围
 */
function validatePriceRange() {
  const { min, max } = form.priceRange;
  if (min >= max) {
    uni.showToast({
      title: '最低价格必须小于最高价格',
      icon: 'none'
    });
    // 重置为默认值
    form.priceRange = { min: 20, max: 100 };
  }
}

/**
 * 添加喜好食材
 */
function addFavoriteIngredient() {
  const value = newFavoriteIngredient.value.trim();
  if (value && !form.favoriteIngredients.includes(value)) {
    form.favoriteIngredients.push(value);
    newFavoriteIngredient.value = '';
  } else if (form.favoriteIngredients.includes(value)) {
    uni.showToast({ title: '已存在该食材', icon: 'none' });
  }
}

function removeFavoriteIngredient(index: number) {
  form.favoriteIngredients.splice(index, 1);
}

/**
 * 添加肉类偏好
 */
function addMeatPreference() {
  const value = newMeatPreference.value.trim();
  if (value && !form.meatPreferences.includes(value)) {
    form.meatPreferences.push(value);
    newMeatPreference.value = '';
  } else if (form.meatPreferences.includes(value)) {
    uni.showToast({ title: '已存在该肉类', icon: 'none' });
  }
}

function removeMeatPreference(index: number) {
  form.meatPreferences.splice(index, 1);
}

/**
 * 添加食堂偏好
 */
function addCanteenPreference() {
  const value = newCanteenPreference.value.trim();
  if (value && !form.canteenPreferences.includes(value)) {
    form.canteenPreferences.push(value);
    newCanteenPreference.value = '';
  } else if (form.canteenPreferences.includes(value)) {
    uni.showToast({ title: '已存在该食堂', icon: 'none' });
  }
}

function removeCanteenPreference(index: number) {
  form.canteenPreferences.splice(index, 1);
}

/**
 * 添加不喜欢的食材
 */
function addAvoidIngredient() {
  const value = newAvoidIngredient.value.trim();
  if (value && !form.avoidIngredients.includes(value)) {
    form.avoidIngredients.push(value);
    newAvoidIngredient.value = '';
  } else if (form.avoidIngredients.includes(value)) {
    uni.showToast({ title: '已存在该食材', icon: 'none' });
  }
}

function removeAvoidIngredient(index: number) {
  form.avoidIngredients.splice(index, 1);
}

/**
 * 保存设置
 */
async function handleSave() {
  // 验证价格范围
  const { min, max } = form.priceRange;
  if (min >= max) {
    uni.showToast({
      title: '最低价格必须小于最高价格',
      icon: 'none'
    });
    return;
  }

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
      meatPreference: form.meatPreferences,
      priceRange: form.priceRange,
      canteenPreferences: form.canteenPreferences,
      avoidIngredients: form.avoidIngredients,
      favoriteIngredients: form.favoriteIngredients
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
