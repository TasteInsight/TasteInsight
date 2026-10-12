<template>
  <view class="page-content settings-page">
    <view v-for="group in visibleGroups" :key="group.title" class="settings-section">
      <text class="settings-hint group-title">{{ group.title }}</text>
      <button
        v-for="item in group.items"
        :key="item.path"
        class="settings-button settings-menu list-row-action"
        hover-class="list-row-pressed"
        @click="item.action.activate"
        @keydown="item.action.handleKeydown"
        @keyup="item.action.handleKeyup"
        @blur="item.action.clearPress"
        role="button"
        tabindex="0"
      >
        <UiIcon :name="item.icon" :size="19" /><text class="settings-menu-label">{{
          item.label
        }}</text
        ><UiIcon name="chevron-right" :size="16" />
      </button>
    </view>
    <button
      v-if="isLoggedIn"
      class="settings-button settings-logout"
      @click="logoutButton.activate"
      @keydown="logoutButton.handleKeydown"
      @keyup="logoutButton.handleKeyup"
      @blur="logoutButton.clearPress"
      role="button"
      tabindex="0"
    >
      <UiIcon name="logout" :size="19" tone="danger" />退出登录
    </button>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import UiIcon from '@/components/UiIcon.vue';
import { useProfile } from '@/pages/profile/composables/use-profile';
import { useButtonActivation } from '@/composables/use-button-activation';
const { isLoggedIn, handleLogout } = useProfile();
const groups = [
  {
    title: '个人与饮食',
    signedIn: true,
    items: [
      { label: '个人信息', path: '/pages/settings/components/personal', icon: 'user' },
      { label: '账号与校园身份', path: '/pages/profile/identity', icon: 'shield' },
      { label: '过敏原', path: '/pages/settings/components/allergens', icon: 'shield' },
      { label: '饮食偏好', path: '/pages/settings/components/preferences', icon: 'star' },
    ],
  },
  {
    title: '使用偏好',
    signedIn: true,
    items: [
      { label: '显示设置', path: '/pages/settings/components/display', icon: 'eye' },
      { label: '通知设置', path: '/pages/settings/components/notifications', icon: 'bell' },
    ],
  },
  {
    title: '关于',
    signedIn: false,
    items: [
      { label: '隐私', path: '/pages/settings/privacy', icon: 'shield' },
      { label: '关于食鉴', path: '/pages/settings/about', icon: 'info' },
    ],
  },
] as const;
const menuGroups = groups.map(group => ({
  ...group,
  items: group.items.map(item => ({
    ...item,
    action: useButtonActivation(() => navigateTo(item.path)),
  })),
}));
const visibleGroups = computed(() =>
  menuGroups.filter(group => !group.signedIn || isLoggedIn.value)
);
const logoutButton = useButtonActivation(handleLogout, () => !isLoggedIn.value);
function navigateTo(path: string) {
  uni.navigateTo({
    url: path,
    fail: () => uni.showToast({ title: '页面跳转失败', icon: 'none' }),
  });
}
</script>
<style scoped>
.group-title {
  margin-bottom: 8px;
  font-weight: 650;
}
.settings-menu {
  gap: 10px;
  font-size: 14px;
}
.settings-menu-label {
  flex: 1;
}
.settings-logout {
  width: 100%;
  gap: 8px;
  color: #b42318;
  font-size: 14px;
}
</style>
