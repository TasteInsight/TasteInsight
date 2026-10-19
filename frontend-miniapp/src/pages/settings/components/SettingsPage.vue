<template>
  <view class="page-content settings-page settings-form-page page-state-layout">
    <EmptyState
      v-if="!user.isLoggedIn"
      class="page-state-region"
      title="登录后管理个人设置"
      icon="settings"
      action-text="登录"
      @action="openLogin"
    />
    <view v-else class="settings-form-body page-state-content" :aria-busy="loading">
      <view
        v-if="!initialized && !loading && loadError"
        class="settings-load-error error-feedback page-state-region"
        role="alert"
      >
        <text class="error-feedback__title">资料未能加载</text>
        <text class="error-feedback__message">{{ loadError }}</text>
        <button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          :disabled="loading"
          @click="retryButton.activate"
          @keydown="retryButton.handleKeydown"
          @keyup="retryButton.handleKeyup"
          @blur="retryButton.clearPress"
          role="button"
          tabindex="0"
        >
          重新加载
        </button>
      </view>
      <EmptyState
        v-if="loading && !initialized"
        class="page-state-region"
        title="正在加载设置…"
        loading
      />
      <template v-if="initialized">
        <view v-if="restoredDraft" class="settings-note">已恢复未保存的修改</view>
        <slot />
      </template>
    </view>
    <view v-if="user.isLoggedIn && initialized" class="settings-save-bar">
      <button
        class="settings-button settings-button--primary"
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
        <text aria-live="polite">{{ saved ? '已保存' : saving ? '保存中…' : '保存修改' }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '@/store/modules/use-user-store';
import { openLogin } from '@/utils/login-navigation';
import EmptyState from '@/components/EmptyState.vue';
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
const retryButton = useButtonActivation(
  () => emit('retry'),
  () => props.loading
);
const saveButton = useButtonActivation(
  () => emit('save'),
  () => !props.canSave
);
</script>

<style scoped>
.settings-form-page {
  display: flex;
  flex-direction: column;
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
  padding: 16px 0 calc(4px + env(safe-area-inset-bottom));
  background: #fff;
}
.settings-save-bar .settings-button {
  min-width: 120px;
}
</style>
