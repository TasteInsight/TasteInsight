<template>
  <view class="w-full min-h-screen p-4" style="max-width: 375px; background: linear-gradient(to bottom, white, rgba(131,49,142,0.05), white);">
    <!-- 说明文字 -->
    <view class="bg-blue-50 rounded-xl p-4 mb-4">
      <text class="text-sm text-blue-800">💡 设置您的过敏原信息，系统会为您过滤包含这些成分的菜品。</text>
    </view>

    <!-- 过敏原输入 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">过敏原列表</text>
      <textarea 
        v-model="form.allergens" 
        class="w-full p-3 border border-gray-200 rounded-lg text-base"
        style="min-height:150px;"
        placeholder="请输入过敏原，多个过敏原用逗号分隔，例如：花生, 牛奶, 鸡蛋, 海鲜"
        maxlength="200"
      />
      <text class="text-xs text-gray-400 mt-2 block">{{ form.allergens.length }}/200</text>
    </view>

    <!-- 常见过敏原快速选择 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">常见过敏原</text>
      <view class="flex flex-wrap gap-2">
        <view 
          v-for="item in commonAllergens" 
          :key="item"
          class="px-4 py-2 rounded-full text-sm border"
          :class="isSelected(item) ? 'bg-red-100 border-red-300 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'"
          @click="toggleAllergen(item)"
        >
          <text>{{ item }}</text>
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
import type { UserProfileUpdateRequest } from '@/types/api';

const userStore = useUserStore();
const saving = ref(false);
const loading = ref(true);
const form = reactive({
  allergens: ''
});

const commonAllergens = ['花生', '牛奶', '鸡蛋', '海鲜', '大豆', '小麦', '坚果', '芝麻'];

/**
 * 加载用户信息
 */
onMounted(async () => {
  try {
    await userStore.fetchProfileAction();
    const userInfo = userStore.userInfo;
    if (userInfo && userInfo.allergens) {
      form.allergens = userInfo.allergens.join(', ');
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  } finally {
    loading.value = false;
  }
});

/**
 * 判断过敏原是否已选中
 */
function isSelected(allergen: string): boolean {
  return form.allergens.split(',').map(a => a.trim()).includes(allergen);
}

/**
 * 切换过敏原选中状态
 */
function toggleAllergen(allergen: string) {
  const allergenList = form.allergens.split(',').map(a => a.trim()).filter(a => a);
  const index = allergenList.indexOf(allergen);
  
  if (index > -1) {
    allergenList.splice(index, 1);
  } else {
    allergenList.push(allergen);
  }
  
  form.allergens = allergenList.join(', ');
}

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
    const payload: UserProfileUpdateRequest = {
      allergens: parseList(form.allergens)
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
