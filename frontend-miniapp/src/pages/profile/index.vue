<template>
  <view class="w-full h-full min-h-screen bg-gray-50 overflow-hidden flex flex-col relative" >
    <!-- 紫色背景头部区域 -->
    <view class="bg-white pt-12 pb-6 px-6">
      <!-- 用户信息头部 -->
      <UserHeader 
        :user-info="userInfo"
        :is-logged-in="isLoggedIn"
        :loading="loading"
        @login="handleLogin" 
      />
    </view>
    
    <!-- 功能菜单区域 -->
    <view class="flex-1 px-4 py-4 flex flex-col space-y-4">
      
      <!-- 第一组：功能入口 (圆角较小的大框) - 仅登录可见 -->
      <view v-if="isLoggedIn" class="bg-white rounded-lg shadow-sm overflow-hidden">
        <view 
          v-for="(item, index) in menuItems" 
          :key="item.id"
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors relative"
          @click="navigateTo(item.path)"
        >
          <view class="flex items-center">
            <text class="iconify text-purple-600 text-xl mr-3" :data-icon="item.icon"></text>
            <text class="text-gray-800 text-base font-medium">{{ item.title }}</text>
          </view>
          <text class="iconify text-gray-400" data-icon="mdi:chevron-right" data-width="20"></text>
          
          <!-- 分隔线 (除了最后一项) -->
          <view v-if="index < menuItems.length - 1" class="absolute bottom-0 left-12 right-0 h-[1px] bg-gray-200"></view>
        </view>
      </view>

      <!-- 第二组：隐私与关于 - 始终可见 -->
      <view class="bg-white rounded-lg shadow-sm overflow-hidden">
        <!-- 隐私 -->
        <view 
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors relative"
          @click="navigateTo('/pages/settings/privacy')"
        >
          <view class="flex items-center">
            <text class="iconify text-purple-600 text-xl mr-3" data-icon="mdi:shield-lock-outline"></text>
            <text class="text-gray-800 text-base font-medium">隐私</text>
          </view>
          <text class="iconify text-gray-400" data-icon="mdi:chevron-right" data-width="20"></text>
          <view class="absolute bottom-0 left-12 right-0 h-[1px] bg-gray-200"></view>
        </view>

        <!-- 关于食鉴 -->
        <view 
          class="flex items-center justify-between p-4 active:bg-gray-50 transition-colors"
          @click="navigateTo('/pages/settings/about')"
        >
          <view class="flex items-center">
            <text class="iconify text-purple-600 text-xl mr-3" data-icon="mdi:information-outline"></text>
            <text class="text-gray-800 text-base font-medium">关于食鉴</text>
          </view>
          <view class="flex items-center">
            <text class="text-gray-400 text-sm mr-2">v1.0.0</text>
            <text class="iconify text-gray-400" data-icon="mdi:chevron-right" data-width="20"></text>
          </view>
        </view>
      </view>

      <!-- 按钮区域 - 仅登录可见 -->
      <view v-if="isLoggedIn" class="mt-4 space-y-3">
        <!-- 设置按钮 (如果仍然需要，或者可以移除如果用户意图是用上面的替代) -->
         <!-- 既然用户没明确说删掉，先保留，但通常这种布局下设置可能会被整合。
              这里保留为底部按钮风格 -->
        <view 
          class="bg-white text-gray-700 flex items-center justify-center py-3 px-8 rounded-full shadow-sm active:bg-gray-50 transition-colors w-full border border-gray-200"
          @click="navigateTo('/pages/settings/index')"
        >
          <text class="iconify" data-icon="mdi:cog" data-width="20"></text>
          <text class="ml-2 font-medium">更多设置</text>
        </view>
        
        <!-- 退出登录按钮 -->
        <view 
          class="bg-white text-red-500 border border-red-100 flex items-center justify-center py-3 px-8 rounded-full shadow-sm active:bg-red-50 transition-colors w-full"
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
import { useProfile } from './composables/use-profile';

// 从 use-profile 中获取所需的状态和方法
const { userInfo, isLoggedIn, loading, handleLogout } = useProfile();

const menuItems = [
  { id: 'reviews', icon: 'mdi:star-outline', title: '我的评价', path: '/pages/profile/my-reviews/index' },
  { id: 'history', icon: 'mdi:history', title: '历史浏览', path: '/pages/profile/history/index' },
  { id: 'favorites', icon: 'mdi:heart-outline', title: '我的收藏', path: '/pages/profile/my-favorites/index' },
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
