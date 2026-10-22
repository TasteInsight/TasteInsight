<template>
  <view class="page-content settings-page">
    <view v-if="!isLoggedIn" class="settings-section">
      <button
        class="settings-button settings-menu list-row-action"
        hover-class="list-row-pressed"
        @click="loginButton.activate"
        @keydown="loginButton.handleKeydown"
        @keyup="loginButton.handleKeyup"
        @blur="loginButton.clearPress"
        role="button"
        tabindex="0"
      >
        <UiIcon name="user" :size="19" /><text class="settings-menu-label">登录</text
        ><UiIcon name="chevron-right" :size="16" />
      </button>
    </view>
    <view v-for="group in visibleGroups" :key="group.title" class="settings-section">
      <text class="settings-hint group-title">{{ group.title }}</text>
      <button
        v-for="item in group.items"
        :key="item.label"
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
        ><text v-if="item.trailingLabel" class="settings-menu-detail">{{ item.trailingLabel }}</text
        ><UiIcon v-else name="chevron-right" :size="16" />
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
import type { UiIconName } from '@/types/ui-icon';
import { copyProjectFeedbackLink } from './utils/project-feedback';
import { openLogin } from '@/utils/login-navigation';
import { useProfile } from '@/pages/profile/composables/use-profile';
import { useButtonActivation } from '@/composables/use-button-activation';
const { isLoggedIn, handleLogout } = useProfile();
type SettingsEntry = {
  label: string;
  icon: UiIconName;
  run: () => void;
  signedIn?: boolean;
  trailingLabel?: string;
};
const groups: { title: string; signedIn: boolean; items: SettingsEntry[] }[] = [
  {
    title: '账号与身份',
    signedIn: true,
    items: [
      {
        label: '个人信息',
        icon: 'user',
        run: () => navigateTo('/pages/settings/components/personal'),
      },
      { label: '账号与校园身份', icon: 'shield', run: () => navigateTo('/pages/profile/identity') },
    ],
  },
  {
    title: '饮食与推荐',
    signedIn: true,
    items: [
      {
        label: '过敏原',
        icon: 'shield',
        run: () => navigateTo('/pages/settings/components/allergens'),
      },
      {
        label: '饮食偏好',
        icon: 'star',
        run: () => navigateTo('/pages/settings/components/preferences'),
      },
    ],
  },
  {
    title: '应用偏好',
    signedIn: true,
    items: [
      {
        label: '显示设置',
        icon: 'eye',
        run: () => navigateTo('/pages/settings/components/display'),
      },
      {
        label: '通知设置',
        icon: 'bell',
        run: () => navigateTo('/pages/settings/components/notifications'),
      },
    ],
  },
  {
    title: '关于',
    signedIn: false,
    items: [{ label: '关于食鉴', icon: 'info', run: () => navigateTo('/pages/settings/about') }],
  },
  {
    title: '反馈与举报',
    signedIn: false,
    items: [
      { label: '项目反馈', icon: 'chat', trailingLabel: '复制链接', run: copyProjectFeedbackLink },
      {
        label: '我的举报',
        icon: 'shield',
        signedIn: true,
        run: () => navigateTo('/pages/profile/my-reports/index'),
      },
    ],
  },
];
const menuGroups = groups.map(group => ({
  ...group,
  items: group.items.map(item => ({
    ...item,
    action: useButtonActivation(item.run),
  })),
}));
const visibleGroups = computed(() =>
  menuGroups
    .filter(group => !group.signedIn || isLoggedIn.value)
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.signedIn || isLoggedIn.value),
    }))
);
const loginButton = useButtonActivation(openLogin, () => isLoggedIn.value);
const logoutButton = useButtonActivation(handleLogout, () => !isLoggedIn.value);
function navigateTo(path: string) {
  uni.navigateTo({
    url: path,
    fail: () => uni.showToast({ title: '页面跳转失败', icon: 'none' }),
  });
}
</script>
<style scoped>
.settings-section {
  padding-bottom: 0;
  margin-bottom: 24px;
  border-bottom: 0;
}
.group-title {
  margin-bottom: 4px;
  color: #475467;
  font-size: 13px;
  font-weight: 600;
}
.settings-menu {
  min-height: 56px;
  gap: 12px;
  font-size: 15px;
}
.settings-menu-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.settings-menu-detail {
  flex-shrink: 0;
  color: #667085;
  font-size: 13px;
}
.settings-logout {
  width: 100%;
  min-height: 48px;
  gap: 8px;
  color: #b42318;
  font-size: 15px;
}
</style>
