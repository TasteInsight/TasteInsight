<!-- @/pages/profile/components/UserHeader.vue -->
<template>
  <div class="user-header-wrapper">
    <div v-if="loading" class="flex items-center py-6">
      <div class="w-20 h-20 rounded-full bg-gray-300 animate-pulse"></div>
      <div class="ml-4">
        <div class="h-6 w-24 bg-gray-300 rounded animate-pulse"></div>
      </div>
    </div>
    
    <div v-else class="flex flex-col items-center py-6">
      <div class="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
        <img v-if="isLoggedIn && userInfo?.avatar" :src="userInfo.avatar" alt="avatar" class="w-full h-full object-cover">
        <span v-else class="iconify text-gray-500" data-icon="mdi:account" data-width="40"></span>
      </div>

      <div v-if="isLoggedIn && userInfo" class="text-center">
        <div class="text-lg font-semibold mt-4">{{ userInfo.nickname }}</div>
        <div class="text-sm text-gray-500 mt-1">ID: {{ userInfo.id }}</div>
      </div>
      
      <div v-else>
        <div class="text-lg font-semibold mt-4">点击登录</div>
        <div class="mt-4">
          <button @click="emit('login')" class="border border-purple-700 rounded-full py-2 px-6 text-purple-700">
            立即登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '@/types/api';

defineProps<{
  userInfo: User | null;
  isLoggedIn: boolean;
  loading: boolean;
}>();

const emit = defineEmits(['login']);
</script>