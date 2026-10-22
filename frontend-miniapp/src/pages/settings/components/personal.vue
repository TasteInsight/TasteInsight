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
          ? t('account.profile.profileReviewUnsuccessful', {
              reason: profileSubmission.reason || t('account.profile.pleaseEditAndResubmit'),
            })
          : t('account.profile.publicProfileUnderReviewIt')
      }}
    </view>
    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.photo') }}</text>
      <button
        class="avatar-edit settings-button list-row-action"
        hover-class="list-row-pressed"
        :hover-stay-time="80"
        :disabled="!canEdit || selecting || uploading"
        @click="chooseAvatar"
      >
        <UserAvatar :src="form.avatar" :size="72" :label="t('account.profile.profilePhoto')" />
        <view class="avatar-edit-copy">
          <text class="settings-label">{{
            uploading ? t('account.settings.uploading') : t('account.settings.changePhoto')
          }}</text>
          <text class="settings-hint">{{ t('account.settings.chooseFromYourAlbumOr') }}</text>
        </view>
        <UiIcon name="chevron-right" :size="16" />
      </button>
    </view>
    <view class="settings-section">
      <label class="settings-title" for="personal-nickname">{{
        t('account.settings.nickname')
      }}</label>
      <input
        id="personal-nickname"
        v-model="form.nickname"
        class="settings-field"
        :disabled="!canEdit"
        :aria-disabled="!canEdit"
        :placeholder="t('account.settings.enterNickname')"
        maxlength="20"
      />
      <text class="settings-hint nickname-count">{{ form.nickname.length }}/20</text>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';
import { usePersonal } from '../composables/use-personal';
import UserAvatar from '@/components/UserAvatar.vue';
import UiIcon from '@/components/UiIcon.vue';
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
  padding-block: 8px;
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
