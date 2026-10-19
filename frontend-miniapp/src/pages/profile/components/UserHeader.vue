<template>
  <view class="user-header">
    <button
      class="user-summary"
      role="button"
      :tabindex="isLoggedIn && !userInfo ? -1 : 0"
      :disabled="isLoggedIn && !userInfo"
      :aria-label="
        isLoggedIn
          ? '管理个人资料：' +
            userInfo?.nickname +
            (userInfo?.capabilities?.canContribute ? '，已认证学生' : '') +
            (userInfo?.bio ? '，' + userInfo.bio : '')
          : '登录食鉴'
      "
      @click="activate"
      @keydown="handleKeydown"
      @keyup="handleKeyup"
      @blur="clearPress"
    >
      <UserAvatar :src="userInfo?.avatar" :size="52" :label="userInfo?.nickname || '个人头像'" />
      <view class="user-copy">
        <view class="user-name-row">
          <text class="user-name">{{ isLoggedIn ? userInfo?.nickname : '欢迎来到食鉴' }}</text>
          <UiIcon
            v-if="userInfo?.capabilities?.canContribute"
            name="shield"
            :size="15"
            tone="primary"
          />
        </view>
        <text class="user-bio">{{
          isLoggedIn ? userInfo?.bio || '填写个人简介' : '点击登录，记录用餐体验'
        }}</text>
      </view>
    </button>
    <text v-if="isLoggedIn && userInfo?.publicProfileSubmission" class="user-moderation-status" role="status">{{ userInfo.publicProfileSubmission.status === 'rejected' ? `资料审核未通过：${userInfo.publicProfileSubmission.reason || '请修改后重新提交'}` : '公开资料审核中，通过后展示' }}</text>
  </view>
</template>
<script setup lang="ts">
import type { User } from '@/types/api';
import UserAvatar from '@/components/UserAvatar.vue';
import UiIcon from '@/components/UiIcon.vue';
import { useButtonActivation } from '@/composables/use-button-activation';
const props = defineProps<{ userInfo: User | null; isLoggedIn: boolean; loading: boolean }>();
const emit = defineEmits<{ (event: 'login'): void; (event: 'manage'): void }>();
const { activate, handleKeydown, handleKeyup, clearPress } = useButtonActivation(
  () => (props.isLoggedIn ? emit('manage') : emit('login')),
  () => props.isLoggedIn && !props.userInfo
);
</script>
<style scoped>
.user-moderation-status { display: block; margin-top: 6px; color: #667085; font-size: 13px; line-height: 1.6; }
.user-header {
  flex: 1;
  min-width: 0;
}
.user-summary {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 64px;
  margin: 0;
  padding: 4px 0;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #1f2937;
  text-align: left;
  line-height: 1.5;
}
.user-summary::after {
  border: 0;
}
.user-summary:active {
  background: #f4f4f5;
}
.user-summary:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.user-summary[disabled] {
  opacity: 0.5;
}
.user-copy {
  flex: 1;
  min-width: 0;
}
.user-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.user-name {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 18px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-bio {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #667085;
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
