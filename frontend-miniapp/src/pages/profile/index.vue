<template>
  <view class="w-full h-[812px] bg-white overflow-hidden flex shadow-lg flex-col relative" >
    <!-- 紫色背景头部区域，约占1/4空间 -->
    <view class="bg-gradient-to-br from-white to-white pt-12 pb-8 px-6">
      <!-- 用户信息头部 -->
      <UserHeader 
        :user-info="userInfo"
        :is-logged-in="isLoggedIn"
        :loading="loading"
        @login="handleLogin" 
      />
    </view>
    
    <!-- 功能菜单区域 -->
    <view class="flex-1 bg-white pt-8 px-4 flex flex-col">
      <!-- 菜单项列表 -->
      <view class="flex flex-col gap-5">
        <MenuItem
          v-for="item in menuItems"
          :key="item.id"
          :icon="item.icon"
          :title="item.title"
          @click="navigateTo(item.path)"
        />
      </view>
      
      <!-- 按钮区域 -->
      <view class="mt-8 space-y-3">
        <!-- 设置按钮 -->
        <view 
          class="bg-ts-purple text-white flex items-center justify-center py-3 px-8 rounded-full active:bg-purple-900 transition-colors w-full"
          hover-class="bg-purple-800"
          @click="navigateTo('/pages/settings/index')"
        >
          <text class="iconify" data-icon="mdi:cog" data-width="20"></text>
          <text class="ml-2 font-medium">设置</text>
        </view>
        
        <!-- 退出登录按钮 -->
        <view 
          v-if="isLoggedIn"
          class="bg-white text-ts-purple border-2 border-ts-purple flex items-center justify-center py-3 px-8 rounded-full active:bg-purple-50 transition-colors w-full"
          hover-class="bg-purple-50"
          @click="handleLogout"
        >
          <text class="iconify" data-icon="mdi:logout" data-width="20"></text>
          <text class="ml-2 font-medium">退出登录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import UserHeader from './components/UserHeader.vue';
import MenuItem from './components/MenuItem.vue';
import { useProfile } from './composables/use-profile';

// 从 use-profile 中获取所需的状态和方法
const { userInfo, isLoggedIn, loading, handleLogout } = useProfile();

const menuItems = [
  { id: 'reviews', icon: 'mdi:star', title: '我的评价', path: '/pages/profile/my-reviews/index' },
  { id: 'history', icon: 'mdi:history', title: '历史浏览', path: '/pages/profile/history/index' },
  { id: 'favorites', icon: 'mdi:heart', title: '我的收藏', path: '/pages/profile/my-favorites/index' },
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
 */
function handleLogin() {
  uni.navigateTo({
    url: '/pages/login/index' 
  });
}
</script>
