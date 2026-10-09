<template>
  <view class="page-content profile-page">
    <view class="profile-header" :aria-busy="loading">
      <UserHeader
        v-if="userInfo || !isLoggedIn"
        :user-info="userInfo"
        :is-logged-in="isLoggedIn"
        :loading="loading"
        @login="handleLogin"
      />
    </view>
    <view v-if="error" class="profile-error">
      <text>{{ error }}</text
      ><button class="profile-retry" @click="fetchProfile">重新加载</button>
    </view>
    <view v-if="isLoggedIn" class="profile-menu-group">
      <button
        v-for="item in menuItems"
        :key="item.id"
        class="profile-menu"
        @click="navigateTo(item.path)"
      >
        <text :class="['iconfont', item.icon]" aria-hidden="true"></text
        ><text class="profile-menu-label">{{ item.title }}</text
        ><text class="iconfont icon-chevronright" aria-hidden="true"></text>
      </button>
    </view>
    <view class="profile-menu-group">
      <button v-if="isLoggedIn" class="profile-menu" @click="navigateTo('/pages/settings/index')">
        <text class="iconfont icon-cog" aria-hidden="true"></text
        ><text class="profile-menu-label">设置</text
        ><text class="iconfont icon-chevronright" aria-hidden="true"></text>
      </button>
      <button class="profile-menu" @click="navigateTo('/pages/settings/privacy')">
        <text class="iconfont icon-shield-lock-outline" aria-hidden="true"></text
        ><text class="profile-menu-label">隐私</text
        ><text class="iconfont icon-chevronright" aria-hidden="true"></text>
      </button>
      <button class="profile-menu" @click="navigateTo('/pages/settings/about')">
        <text class="iconfont icon-informationoutline" aria-hidden="true"></text
        ><text class="profile-menu-label">关于食鉴</text
        ><text class="profile-version">v1.0.0</text
        ><text class="iconfont icon-chevronright" aria-hidden="true"></text>
      </button>
    </view>
    <button v-if="isLoggedIn" class="profile-logout" @click="handleLogout">退出登录</button>
  </view>
</template>
<script setup lang="ts">
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import UserHeader from './components/UserHeader.vue';
import { useProfile } from './composables/use-profile';
const { userInfo, isLoggedIn, loading, error, handleLogout, fetchProfile } = useProfile();
onShow(() => {
  if (isLoggedIn.value) void fetchProfile();
});
onPullDownRefresh(async () => {
  try {
    if (await fetchProfile()) uni.showToast({ title: '刷新成功', icon: 'success', duration: 1500 });
  } finally {
    uni.stopPullDownRefresh();
  }
});
const menuItems = [
  {
    id: 'reviews',
    icon: 'icon-staroutline',
    title: '我的评价',
    path: '/pages/profile/my-reviews/index',
  },
  {
    id: 'favorites',
    icon: 'icon-heart-outline',
    title: '我的收藏',
    path: '/pages/profile/my-favorites/index',
  },
  { id: 'history', icon: 'icon-history', title: '历史浏览', path: '/pages/profile/history/index' },
];
function navigateTo(path: string) {
  uni.navigateTo({ url: path, fail: () => uni.showToast({ title: '页面跳转失败', icon: 'none' }) });
}
function handleLogin() {
  navigateTo('/pages/login/index');
}
</script>
<style scoped>
.profile-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 20px;
  background: #fff;
  color: #1f2937;
}
.profile-header {
  box-sizing: border-box;
  min-height: 106px;
  padding-bottom: 24px;
}
.profile-menu-group {
  padding: 8px 0;
  margin-bottom: 16px;
  border-top: 1px solid #e5e7eb;
}
.profile-menu {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 60px;
  margin: 0;
  padding: 14px 0;
  border: 0;
  border-radius: 0;
  background: #fff;
  color: #475467;
  text-align: left;
  font-size: 16px;
  line-height: 1.5;
}
.profile-menu-label {
  flex: 1;
  color: #1f2937;
}
.profile-menu .iconfont {
  font-size: 21px;
}
.profile-version {
  color: #667085;
  font-size: 13px;
}
.profile-menu::after,
.profile-logout::after,
.profile-retry::after {
  border: 0;
}
.profile-menu:active {
  background: #f4f4f5;
}
.profile-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 8px 0 0;
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #b42318;
  font-size: 15px;
  line-height: 1.5;
}
.profile-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 16px;
  color: #b42318;
  font-size: 14px;
}
.profile-retry {
  min-height: 44px;
  margin: 0;
  border: 0;
  background: #fff;
  color: #660874;
  font-size: 14px;
}
.profile-menu:focus-visible,
.profile-logout:focus-visible,
.profile-retry:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
@media (max-width: 340px) {
  .profile-page {
    padding: 20px 16px;
  }
}
</style>
