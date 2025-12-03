<template>
  <view class="w-full min-h-screen bg-gray-50 p-4 pb-10">
    
    <!-- 口味偏好 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <text class="text-lg font-semibold text-gray-800 mb-6 block">口味偏好</text>

      <!-- 辣度 -->
      <view class="mb-8">
        <view class="flex justify-between items-center mb-3">
          <text class="text-base text-gray-700 font-medium">辣度</text>
          <text class="text-sm text-ts-purple font-bold bg-purple-50 px-2 py-0.5 rounded">{{ spicinessLabels[form.spiciness] }}</text>
        </view>
        <slider 
          :value="form.spiciness" 
          min="0" 
          max="5" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#F3F4F6"
          block-size="24"
          @change="(e: any) => form.spiciness = e.detail.value"
        />
        <view class="flex justify-between mt-2 px-1">
          <view v-for="(label, index) in spicinessLabels" :key="index" class="flex flex-col items-center" style="width: 16%;">
             <text class="text-xs text-gray-400 mb-0.5">{{ index }}</text>
             <text class="text-[10px] text-gray-500 text-center">{{ label }}</text>
          </view>
        </view>
      </view>

      <!-- 甜度 -->
      <view class="mb-8">
        <view class="flex justify-between items-center mb-3">
          <text class="text-base text-gray-700 font-medium">甜度</text>
          <text class="text-sm text-ts-purple font-bold bg-purple-50 px-2 py-0.5 rounded">{{ tasteLabels[form.sweetness] }}</text>
        </view>
        <slider 
          :value="form.sweetness" 
          min="0" 
          max="5" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#F3F4F6"
          block-size="24"
          @change="(e: any) => form.sweetness = e.detail.value"
        />
        <view class="flex justify-between mt-2 px-1">
          <view v-for="(label, index) in tasteLabels" :key="index" class="flex flex-col items-center" style="width: 16%;">
             <text class="text-xs text-gray-400 mb-0.5">{{ index }}</text>
             <text class="text-[10px] text-gray-500 text-center">{{ label }}</text>
          </view>
        </view>
      </view>

      <!-- 咸度 -->
      <view class="mb-8">
        <view class="flex justify-between items-center mb-3">
          <text class="text-base text-gray-700 font-medium">咸度</text>
          <text class="text-sm text-ts-purple font-bold bg-purple-50 px-2 py-0.5 rounded">{{ tasteLabels[form.saltiness] }}</text>
        </view>
        <slider 
          :value="form.saltiness" 
          min="0" 
          max="5" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#F3F4F6"
          block-size="24"
          @change="(e: any) => form.saltiness = e.detail.value"
        />
        <view class="flex justify-between mt-2 px-1">
          <view v-for="(label, index) in tasteLabels" :key="index" class="flex flex-col items-center" style="width: 16%;">
             <text class="text-xs text-gray-400 mb-0.5">{{ index }}</text>
             <text class="text-[10px] text-gray-500 text-center">{{ label }}</text>
          </view>
        </view>
      </view>

      <!-- 油腻度 -->
      <view class="mb-2">
        <view class="flex justify-between items-center mb-3">
          <text class="text-base text-gray-700 font-medium">油腻度</text>
          <text class="text-sm text-ts-purple font-bold bg-purple-50 px-2 py-0.5 rounded">{{ tasteLabels[form.oiliness] }}</text>
        </view>
        <slider 
          :value="form.oiliness" 
          min="0" 
          max="5" 
          step="1"
          activeColor="#82318E"
          backgroundColor="#F3F4F6"
          block-size="24"
          @change="(e: any) => form.oiliness = e.detail.value"
        />
        <view class="flex justify-between mt-2 px-1">
          <view v-for="(label, index) in tasteLabels" :key="index" class="flex flex-col items-center" style="width: 16%;">
             <text class="text-xs text-gray-400 mb-0.5">{{ index }}</text>
             <text class="text-[10px] text-gray-500 text-center">{{ label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 喜好食材 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">喜好食材</text>
      <view class="flex items-center space-x-2 mb-4">
        <input 
          v-model="newFavoriteIngredient" 
          class="flex-1 p-3 border border-gray-200 rounded-lg text-base focus:border-ts-purple focus:ring-1 focus:ring-purple-100 transition-all"
          placeholder="请输入食材名称"
          maxlength="20"
          @confirm="addFavoriteIngredient"
        />
        <button 
          class="px-5 py-3 bg-purple-50 text-ts-purple border border-purple-100 rounded-lg text-sm font-medium active:bg-purple-100"
          @click="addFavoriteIngredient"
        >
          添加
        </button>
      </view>
      <view class="flex flex-wrap gap-2" v-if="form.favoriteIngredients.length > 0">
        <view 
          v-for="(item, index) in form.favoriteIngredients" 
          :key="index"
          class="px-3 py-1.5 bg-purple-50 text-ts-purple rounded-lg text-sm flex items-center border border-purple-100"
        >
          <text>{{ item }}</text>
          <view class="ml-2 w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center" @click="removeFavoriteIngredient(index)">
             <text class="text-xs text-purple-700 font-bold">×</text>
          </view>
        </view>
      </view>
      <view v-else class="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        暂无添加
      </view>
    </view>

    <!-- 分量偏好 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">分量偏好</text>
      <picker :value="Object.values(portionLabels).indexOf(portionLabels[form.portionSize])" :range="Object.values(portionLabels)" @change="(e: any) => form.portionSize = reversePortionLabels[Object.values(portionLabels)[e.detail.value]]">
        <view class="w-full p-3 border border-gray-200 rounded-lg flex justify-between items-center bg-white active:bg-gray-50 transition-colors">
           <text class="text-gray-800">{{ portionLabels[form.portionSize] }}</text>
           <text class="iconify text-gray-400" data-icon="mdi:chevron-down" data-width="20"></text>
        </view>
      </picker>
    </view>

    <!-- 肉类偏好 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">肉类偏好</text>
      <view class="flex items-center space-x-2 mb-4">
        <input 
          v-model="newMeatPreference" 
          class="flex-1 p-3 border border-gray-200 rounded-lg text-base focus:border-ts-purple focus:ring-1 focus:ring-purple-100 transition-all"
          placeholder="请输入肉类名称"
          maxlength="20"
          @confirm="addMeatPreference"
        />
        <button 
          class="px-5 py-3 bg-purple-50 text-ts-purple border border-purple-100 rounded-lg text-sm font-medium active:bg-purple-100"
          @click="addMeatPreference"
        >
          添加
        </button>
      </view>
      <view class="flex flex-wrap gap-2" v-if="form.meatPreference.length > 0">
        <view 
          v-for="(item, index) in form.meatPreference" 
          :key="index"
          class="px-3 py-1.5 bg-purple-50 text-ts-purple rounded-lg text-sm flex items-center border border-purple-100"
        >
          <text>{{ item }}</text>
          <view class="ml-2 w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center" @click="removeMeatPreference(index)">
             <text class="text-xs text-purple-700 font-bold">×</text>
          </view>
        </view>
      </view>
      <view v-else class="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        暂无添加
      </view>
    </view>

    <!-- 价格偏好范围 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">价格偏好范围 (元)</text>
      <view class="flex items-center space-x-4">
        <view class="flex-1 relative">
           <input 
            v-model.number="form.priceRange.min" 
            type="number" 
            class="w-full p-3 border border-gray-200 rounded-lg text-base text-center focus:border-ts-purple transition-all" 
            placeholder="最低价"
            min="0"
            @blur="validatePriceRange"
          />
        </view>
        <text class="text-gray-400 font-bold">-</text>
        <view class="flex-1 relative">
           <input 
            v-model.number="form.priceRange.max" 
            type="number" 
            class="w-full p-3 border border-gray-200 rounded-lg text-base text-center focus:border-ts-purple transition-all" 
            placeholder="最高价"
            min="0"
            @blur="validatePriceRange"
          />
        </view>
      </view>
    </view>

    <!-- 食堂偏好 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">食堂偏好</text>
      
      <!-- 食堂选择器 -->
      <view class="mb-4">
        <picker class="w-full" mode="selector" :range="canteenList" range-key="name" @change="onCanteenSelect">
          <view class="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
            <text class="text-sm text-gray-700">选择食堂</text>
            <text class="text-gray-400">▼</text>
          </view>
        </picker>
      </view>
      
      <view class="flex flex-wrap gap-2" v-if="form.canteenPreferences.length > 0">
        <view 
          v-for="(canteenId, index) in form.canteenPreferences" 
          :key="canteenId"
          class="px-3 py-1.5 bg-purple-50 text-ts-purple rounded-lg text-sm flex items-center border border-purple-100"
        >
          <text>{{ getCanteenNameById(canteenId) }}</text>
          <view class="ml-2 w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center" @click="removeCanteenPreference(index)">
             <text class="text-xs text-purple-700 font-bold">×</text>
          </view>
        </view>
      </view>
      <view v-else class="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        暂无添加
      </view>
    </view>

    <!-- 不喜欢的食材 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-100">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">不喜欢的食材</text>
      <view class="flex items-center space-x-2 mb-4">
        <input 
          v-model="newAvoidIngredient" 
          class="flex-1 p-3 border border-gray-200 rounded-lg text-base focus:border-ts-purple focus:ring-1 focus:ring-purple-100 transition-all"
          placeholder="请输入食材名称"
          maxlength="20"
          @confirm="addAvoidIngredient"
        />
        <button 
          class="px-5 py-3 bg-purple-50 text-ts-purple border border-purple-100 rounded-lg text-sm font-medium active:bg-purple-100"
          @click="addAvoidIngredient"
        >
          添加
        </button>
      </view>
      <view class="flex flex-wrap gap-2" v-if="form.avoidIngredients.length > 0">
        <view 
          v-for="(item, index) in form.avoidIngredients" 
          :key="index"
          class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm flex items-center border border-red-100"
        >
          <text>{{ item }}</text>
          <view class="ml-2 w-4 h-4 rounded-full bg-red-200 flex items-center justify-center" @click="removeAvoidIngredient(index)">
             <text class="text-xs text-red-700 font-bold">×</text>
          </view>
        </view>
      </view>
      <view v-else class="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        暂无添加
      </view>
    </view>

    <!-- 保存按钮 -->
    <button 
      class="w-full py-3.5 bg-ts-purple text-white rounded-full text-base font-semibold shadow-md active:bg-purple-800 active:scale-[0.99] transition-all mt-4"
      :class="{ 'opacity-70': saving }"
      :disabled="saving"
      @click="handleSave"
    >
      <text>{{ saving ? '保存中...' : '保存修改' }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { updateUserProfile } from '@/api/modules/user';
import type { UserProfileUpdateRequest, UserPreference } from '@/types/api';

const userStore = useUserStore();
const canteenStore = useCanteenStore();
const saving = ref(false);
const loading = ref(true);
const form = reactive({
  spiciness: 0,
  sweetness: 0,
  saltiness: 0,
  oiliness: 0,
  portionSize: 'medium' as 'small' | 'medium' | 'large',
  meatPreference: [] as string[],
  priceRange: { min: 20, max: 100 },
  canteenPreferences: [] as string[],
  avoidIngredients: [] as string[],
  favoriteIngredients: [] as string[]
});

const newFavoriteIngredient = ref('');
const newMeatPreference = ref('');
const newCanteenPreference = ref('');
const newAvoidIngredient = ref('');

// 食堂列表
const canteenList = computed(() => canteenStore.canteenList);

const tasteLabels = ['未设置', '清淡', '适中', '偏重', '很重', '极重'];
const spicinessLabels = ['未设置', '微辣', '中辣', '重辣', '特辣', '变态辣'];
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
    // 加载食堂列表
    if (canteenStore.canteenList.length === 0) {
      await canteenStore.fetchCanteenList();
    }
    
    await userStore.fetchProfileAction();
    const userInfo = userStore.userInfo;
    if (userInfo && userInfo.preferences) {
      const pref = userInfo.preferences;
      if (pref.tastePreferences) {
        form.spiciness = pref.tastePreferences.spicyLevel ?? 0;
        form.sweetness = pref.tastePreferences.sweetness ?? 0;
        form.saltiness = pref.tastePreferences.saltiness ?? 0;
        form.oiliness = pref.tastePreferences.oiliness ?? 0;
      }
      form.portionSize = pref.portionSize ?? 'medium';
      form.meatPreference = pref.meatPreference ?? [];
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
  if (value && !form.meatPreference.includes(value)) {
    form.meatPreference.push(value);
    newMeatPreference.value = '';
  } else if (form.meatPreference.includes(value)) {
    uni.showToast({ title: '已存在该肉类', icon: 'none' });
  }
}

function removeMeatPreference(index: number) {
  form.meatPreference.splice(index, 1);
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
 * 选择食堂
 */
function onCanteenSelect(e: any) {
  const index = e.detail.value;
  const selectedCanteen = canteenList.value[index];
  if (selectedCanteen) {
    const canteenId = selectedCanteen.id;
    if (!form.canteenPreferences.includes(canteenId)) {
      form.canteenPreferences.push(canteenId);
    } else {
      uni.showToast({ title: '已存在该食堂', icon: 'none' });
    }
  }
}

/**
 * 根据食堂ID获取食堂名称
 */
function getCanteenNameById(canteenId: string): string {
  const canteen = canteenList.value.find((c: any) => c.id === canteenId);
  return canteen ? canteen.name : canteenId;
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
        spicyLevel: form.spiciness,
        sweetness: form.sweetness,
        saltiness: form.saltiness,
        oiliness: form.oiliness
      },
      portionSize: form.portionSize,
      meatPreference: form.meatPreference,
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
