<template>
  <view class="w-full min-h-screen p-4 bg-gray-50">
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

const commonAllergens = ['花生', '牛奶', '鸡蛋', '海鲜', '大豆', '小麦', '坚果', '芝麻', '芒果', '菠萝', '猕猴桃', '桃子', '蚕豆'];

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
  return form.allergens.split(/[,，]/).map(a => a.trim()).includes(allergen);
}

/**
 * 切换过敏原选中状态
 */
function toggleAllergen(allergen: string) {
  let allergenList = form.allergens.split(/[,，]/).map(a => a.trim()).filter(a => a);
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
