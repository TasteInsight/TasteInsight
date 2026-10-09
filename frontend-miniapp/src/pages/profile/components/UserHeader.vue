<template>
  <view class="user-header">
    <UserAvatar :src="userInfo?.avatar" :size="72" :label="userInfo?.nickname || '个人头像'" />
    <view class="user-header-content">
      <template v-if="isLoggedIn">
        <text class="user-name">{{ userInfo?.nickname || '正在加载个人资料…' }}</text>
        <button class="user-action" :disabled="!userInfo" @click="handleEditProfile">
          编辑资料<text class="iconfont icon-chevronright" aria-hidden="true"></text>
        </button>
      </template>
      <template v-else>
        <text class="user-name">欢迎来到食鉴</text>
        <text class="user-hint">登录后管理评价、收藏与饮食偏好</text>
        <button class="user-action user-action-primary" @click="$emit('login')">立即登录</button>
      </template>
    </view>
  </view>
</template>
<script setup lang="ts">
import type { User } from '@/types/api';
import UserAvatar from '@/components/UserAvatar.vue';
defineProps<{ userInfo: User | null; isLoggedIn: boolean; loading: boolean }>();
defineEmits<{ (event: 'login'): void }>();
function handleEditProfile() {
  uni.navigateTo({
    url: '/pages/settings/components/personal',
    fail: () => uni.showToast({ title: '页面跳转失败', icon: 'none' }),
  });
}
</script>
<style scoped>
.user-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
}
.user-header-content {
  min-width: 0;
  flex: 1;
}
.user-name {
  display: block;
  color: #111827;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.user-hint {
  display: block;
  margin-top: 6px;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}
.user-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: 8px 0 0;
  padding: 8px 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #660874;
  font-size: 14px;
  line-height: 1.5;
}
.user-action::after {
  border: 0;
}
.user-action-primary {
  padding: 10px 16px;
  background: #660874;
  color: #fff;
}
.user-action:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
</style>
