<template>
  <view class="page-content settings-page settings-form-page page-state-layout">
    <LoginGate :title="t('account.settings.signInToManagePersonal')" icon="settings">
      <view class="settings-form-body page-state-content" :aria-busy="loading">
        <AsyncState
          class="settings-load-state"
          :loading="loading"
          :initialized="initialized"
          :has-content="initialized"
          :error="loadError"
          :error-title="t('account.settings.unableToLoadProfile')"
          :loading-title="t('account.settings.loadingSettings')"
          @retry="emit('retry')"
        />
        <template v-if="initialized">
          <view v-if="restoredDraft" class="settings-note">{{
            t('account.settings.unsavedChangesRestored')
          }}</view>
          <slot />
        </template>
      </view>
    </LoginGate>
    <view v-if="user.isLoggedIn && initialized" class="settings-save-bar">
      <button
        class="settings-button settings-button--primary"
        hover-class="settings-button--pressed"
        :hover-stay-time="80"
        :disabled="!canSave"
        :aria-disabled="!canSave"
        :aria-busy="saving"
        :tabindex="canSave ? 0 : -1"
        @click="saveButton.activate"
        @keydown="saveButton.handleKeydown"
        @keyup="saveButton.handleKeyup"
        @blur="saveButton.clearPress"
        role="button"
      >
        <text aria-live="polite">{{
          saved
            ? t('account.settings.saved')
            : saving
              ? t('account.profile.saving')
              : t('account.settings.saveChanges')
        }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { useUserStore } from '@/store/modules/use-user-store';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
import { useButtonActivation } from '@/composables/use-button-activation';

const user = useUserStore();
const props = defineProps<{
  loading: boolean;
  initialized: boolean;
  loadError: string;
  saving: boolean;
  saved: boolean;
  canSave: boolean;
  restoredDraft: boolean;
}>();
const emit = defineEmits<{ (e: 'retry'): void; (e: 'save'): void }>();
const saveButton = useButtonActivation(
  () => emit('save'),
  () => !props.canSave
);
</script>

<style scoped>
.settings-form-page {
  display: flex;
  flex-direction: column;
  padding-bottom: 0;
}
.settings-form-body {
  flex: 1;
  min-width: 0;
}
.settings-save-bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16px 0 calc(20px + env(safe-area-inset-bottom));
  background: #fff;
}
.settings-save-bar .settings-button {
  min-width: 120px;
}
</style>
