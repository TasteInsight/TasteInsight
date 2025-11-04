<template>
  <div class="app-page">
    <div class="content-container">
      <UserHeader 
        :user-info="userInfo"
        :is-logged-in="isLoggedIn"
        :loading="loading"
        @login="handleLogin" 
      />
      
      <div v-if="isLoggedIn">
        <MenuItem
          v-for="item in menuItems"
          :key="item.id"
          :icon="item.icon"
          :title="item.title"
          @click="navigateTo(item.path)"
        />
      </div>

      <div class="absolute bottom-0 left-0 right-0 flex justify-center py-5">
        <button class="text-purple-700 flex items-center" @click="navigateTo('/profile/settings')">
          <span class="iconify" data-icon="mdi:cog" data-width="20"></span>
          <span class="ml-2">设置</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import UserHeader from './components/UserHeader.vue';
import MenuItem from './components/MenuItem.vue';
import { useProfile } from './composables/use-profile';

// 假设您有一个 useAuth 的 composable 来处理登录弹窗
// import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { userInfo, isLoggedIn, loading } = useProfile();
// const { showLoginModal } = useAuth();

const menuItems = [
  { id: 'reviews', icon: 'mdi:star', title: '我的评价', path: '/profile/my-reviews' },
  { id: 'history', icon: 'mdi:history', title: '历史浏览', path: '/profile/history' },
  { id: 'favorites', icon: 'mdi:heart', title: '我的收藏', path: '/profile/my-favorites' },
];

function navigateTo(path: string) {
  router.push(path);
}

function handleLogin() {
  // 这里调用您的全局登录逻辑，例如弹出一个登录模态框
  // showLoginModal();
  console.log("Trigger login flow...");
}
</script>