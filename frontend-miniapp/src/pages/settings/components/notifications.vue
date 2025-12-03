<template>
  <view class="w-full min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white p-4" style="max-width: 375px;">
    <!-- 通知设置 -->
    <view class="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">通知设置</text>
      
      <!-- 新菜品提醒 -->
      <view class="flex justify-between items-center py-3 border-b border-gray-100">
        <view>
          <text class="text-base text-gray-700 block">新菜品提醒</text>
          <text class="text-xs text-gray-400 mt-1">当食堂上架新菜品时通知您</text>
        </view>
        <switch 
          :checked="form.newDishAlert" 
          color="#82318E"
          @change="(e: any) => form.newDishAlert = e.detail.value"
        />
      </view>

      <!-- 价格变动提醒 -->
      <view class="flex justify-between items-center py-3 border-b border-gray-100">
        <view>
          <text class="text-base text-gray-700 block">价格变动提醒</text>
          <text class="text-xs text-gray-400 mt-1">当收藏菜品价格变动时通知您</text>
        </view>
        <switch 
          :checked="form.priceChangeAlert" 
          color="#82318E"
          @change="(e: any) => form.priceChangeAlert = e.detail.value"
        />
      </view>

      <!-- 评价回复提醒 -->
      <view class="flex justify-between items-center py-3 border-b border-gray-100">
        <view>
          <text class="text-base text-gray-700 block">评价回复提醒</text>
          <text class="text-xs text-gray-400 mt-1">当您的评价收到回复时通知您</text>
        </view>
        <switch 
          :checked="form.reviewReplyAlert" 
          color="#82318E"
          @change="(e: any) => form.reviewReplyAlert = e.detail.value"
        />
      </view>

      <!-- 每周推荐 -->
      <view class="flex justify-between items-center py-3">
        <view>
          <text class="text-base text-gray-700 block">每周推荐</text>
          <text class="text-xs text-gray-400 mt-1">每周为您推荐本周热门菜品</text>
        </view>
        <switch 
          :checked="form.weeklyRecommendation" 
          color="#82318E"
          @change="(e: any) => form.weeklyRecommendation = e.detail.value"
        />
      </view>
    </view>

    <!-- 说明文字 -->
    <view class="bg-blue-50 rounded-xl p-4 mb-4">
      <text class="text-xs text-blue-800">💡 您可以随时在此处管理通知偏好设置</text>
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
import type { UserProfileUpdateRequest, UserPreference, UserSettings } from '@/types/api';

const userStore = useUserStore();
const saving = ref(false);
const loading = ref(true);
const form = reactive({
  newDishAlert: true,
  priceChangeAlert: false,
  reviewReplyAlert: true,
  weeklyRecommendation: true
});

/**
 * 加载用户信息
 */
onMounted(async () => {
  try {
    await userStore.fetchProfileAction();
    const userInfo = userStore.userInfo;
    if (userInfo && userInfo.settings && userInfo.settings.notificationSettings) {
      const notif = userInfo.settings.notificationSettings;
      form.newDishAlert = notif.newDishAlert ?? true;
      form.priceChangeAlert = notif.priceChangeAlert ?? false;
      form.reviewReplyAlert = notif.reviewReplyAlert ?? true;
      form.weeklyRecommendation = notif.weeklyRecommendation ?? true;
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  } finally {
    loading.value = false;
  }
});

/**
 * 保存设置
 */
async function handleSave() {
  saving.value = true;
  try {
    const settings: Partial<UserSettings> = {
      notificationSettings: {
        newDishAlert: form.newDishAlert,
        priceChangeAlert: form.priceChangeAlert,
        reviewReplyAlert: form.reviewReplyAlert,
        weeklyRecommendation: form.weeklyRecommendation
      }
    };

    const payload: UserProfileUpdateRequest = {
      settings
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
