<template>
  <div class="app-page">
    <div class="content-container">
      <!-- 1. 用户信息头部 -->
      <UserHeader 
        :user-info="userInfo"
        :is-logged-in="isLoggedIn"
        :loading="loading"
        @login="handleLogin" 
      />
      
      <!-- 2. 功能菜单 -->
      <div>
        <MenuItem
          v-for="item in menuItems"
          :key="item.id"
          :icon="item.icon"
          :title="item.title"
          @click="navigateTo(item.path)"
        />
      </div>

      <!-- 3. 设置入口 -->
      <div class="absolute bottom-0 left-0 right-0 flex justify-center py-5">
        <button class="text-purple-700 flex items-center" @click="navigateTo('/pages/profile/settings')">
          <span class="iconify" data-icon="mdi:cog" data-width="20"></span>
          <span class="ml-2">设置</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import UserHeader from './components/UserHeader.vue';
import MenuItem from './components/MenuItem.vue';
import { useProfile } from './composables/use-profile'; // 确保路径正确

// 从 use-profile 中获取所需的状态和方法
const { userInfo, isLoggedIn, loading } = useProfile();

const menuItems = [
  { id: 'reviews', icon: 'mdi:star', title: '我的评价', path: '/pages/profile/my-reviews' },
  { id: 'history', icon: 'mdi:history', title: '历史浏览', path: '/pages/profile/history' },
  { id: 'favorites', icon: 'mdi:heart', title: '我的收藏', path: '/pages/profile/my-favorites' },
];

/**
 * 使用 Uni-app API 进行页面跳转
 * @param {string} path - 在 pages.json 中定义的页面路径
 */
function navigateTo(path: string) {
  uni.navigateTo({
    url: path,
    fail: (err) => {
      console.error(`跳转失败: ${path}`, err);
      uni.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    }
  });
}

/**
 * 处理登录逻辑
 * 通常是跳转到专门的登录页面
 */
function handleLogin() {
  uni.navigateTo({
    url: '/pages/login/index' 
  });
}
</script>

<style scoped>
/* 您的样式保持不变 */
.app-page {
  position: relative;
  width: 375px;
  height: 812px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.content-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
  position: relative; 
}
</style>