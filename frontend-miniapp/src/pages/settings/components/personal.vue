<template>
  <SettingsPage
    v-bind="pageState"
    :can-save="canSave && !uploading && !selecting"
    @retry="loadProfile"
    @save="handleSave"
  >
    <view v-if="profileSubmission" class="settings-note" role="status">
      {{
        profileSubmission.status === 'rejected'
          ? `资料审核未通过：${profileSubmission.reason || '请修改后重新提交'}`
          : '公开资料审核中，通过后展示'
      }}
    </view>
    <view class="settings-section">
      <text class="settings-title">头像</text>
      <button
        class="avatar-edit settings-button"
        :disabled="!canEdit || selecting || uploading"
        @click="chooseAvatar"
      >
        <UserAvatar :src="form.avatar" :size="72" label="个人头像" />
        <view class="avatar-edit-copy">
          <text class="settings-label">{{ uploading ? '正在上传…' : '更换头像' }}</text>
          <text class="settings-hint">从相册选择或拍摄照片</text>
        </view>
        <text class="iconfont icon-chevronright" aria-hidden="true"></text>
      </button>
    </view>
    <view class="settings-section">
      <label class="settings-title" for="personal-nickname">昵称</label>
      <input
        id="personal-nickname"
        v-model="form.nickname"
        class="settings-field"
        :disabled="!canEdit"
        placeholder="请输入昵称"
        maxlength="20"
      />
      <text class="settings-hint nickname-count">{{ form.nickname.length }}/20</text>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';
import { usePersonal } from '../composables/use-personal';
import UserAvatar from '@/components/UserAvatar.vue';
import SettingsPage from './SettingsPage.vue';
const state = usePersonal();
const {
  form,
  profileSubmission,
  uploading,
  selecting,
  canEdit,
  canSave,
  loadProfile,
  chooseAvatar,
  handleSave,
  handleBackPress,
} = state;
const pageState = computed(() => ({
  loading: state.loading.value,
  initialized: state.initialized.value,
  loadError: state.loadError.value,
  saving: state.saving.value,
  saved: state.saved.value,
  restoredDraft: state.restoredDraft.value,
}));
onBackPress(handleBackPress);
</script>
<style scoped>
.avatar-edit {
  width: 100%;
  justify-content: flex-start;
  gap: 16px;
  padding: 8px 0;
  border: 0;
  text-align: left;
}
.avatar-edit-copy {
  min-width: 0;
  flex: 1;
}
.nickname-count {
  margin-top: 8px;
  text-align: right;
}
</style>
