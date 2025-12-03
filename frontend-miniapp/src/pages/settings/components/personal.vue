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
import { usePersonal } from '../composables/use-personal';

const { form, saving, chooseAvatar, handleSave } = usePersonal();
</script>
