<template>
  <view class="w-full min-h-screen bg-gray-50 p-4">
    <!-- 头像上传区域 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-6 block">头像</text>
      <view class="flex flex-col items-center">
        <view class="relative mb-6">
           <image 
            :src="form.avatar || '/static/images/default-avatar.png'" 
            class="w-24 h-24 rounded-full border-4 border-purple-50"
            mode="aspectFill"
            @click="chooseAvatar"
          />
           <view 
            class="absolute bottom-0 right-0 bg-ts-purple rounded-full p-1.5 border-2 border-white shadow-sm"
            @click="chooseAvatar"
           >
             <text class="iconify text-white" data-icon="mdi:camera" data-width="14"></text>
           </view>
        </view>
        <text class="text-gray-500 text-sm mb-2">点击图片或相机图标更换头像</text>
      </view>
    </view>

    <!-- 昵称设置 -->
    <view class="bg-white rounded-lg p-6 mb-4 shadow-sm">
      <text class="text-lg font-semibold text-gray-800 mb-4 block">昵称</text>
      <view class="relative">
         <input 
          v-model="form.nickname" 
          class="w-full p-3 pr-12 border border-gray-200 rounded-lg text-base focus:border-ts-purple focus:ring-1 focus:ring-purple-100 transition-all"
          placeholder="请输入昵称"
          maxlength="20"
        />
         <text class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{{ form.nickname.length }}/20</text>
      </view>
    </view>

    <!-- 保存按钮 -->
    <button 
      class="w-full py-3.5 bg-ts-purple text-white rounded-full text-base font-semibold shadow-md active:bg-purple-800 active:scale-[0.99] transition-all mt-8"
      :class="{ 'opacity-70': saving }"
      :disabled="saving"
      @click="handleSave"
    >
      <text>{{ saving ? '保存中...' : '保存修改' }}</text>
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
  avatar: '',
  nickname: ''
});

/**
 * 加载用户信息
 */
onMounted(async () => {
  try {
    await userStore.fetchProfileAction();
    const userInfo = userStore.userInfo;
    if (userInfo) {
      form.avatar = userInfo.avatar || '';
      form.nickname = userInfo.nickname || '';
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  } finally {
    loading.value = false;
  }
});

/**
 * 选择头像
 */
function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      form.avatar = res.tempFilePaths[0];
      // TODO: 上传到服务器获取 URL
    },
    fail: (err) => {
      console.error('选择图片失败:', err);
      uni.showToast({
        title: '选择图片失败',
        icon: 'none'
      });
    }
  });
}

/**
 * 保存设置
 */
async function handleSave() {
  if (!form.nickname.trim()) {
    uni.showToast({
      title: '请输入昵称',
      icon: 'none'
    });
    return;
  }

  saving.value = true;
  try {
    const payload: UserProfileUpdateRequest = {
      nickname: form.nickname.trim(),
      avatar: form.avatar.trim() || undefined
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
