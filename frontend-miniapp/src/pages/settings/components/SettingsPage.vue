<template>
  <view class="page-content settings-page settings-form-page">
    <view class="settings-form-body" :aria-busy="loading">
      <view v-if="!initialized && !loading && loadError" class="settings-load-error" role="alert">
        <text class="settings-label">资料未能加载</text>
        <text class="settings-hint">{{ loadError }}</text>
        <button class="settings-button" :disabled="loading" @click="$emit('retry')">
          重新加载
        </button>
      </view>
      <template v-if="initialized">
        <view v-if="restoredDraft" class="settings-note">已恢复未保存的修改</view>
        <slot />
      </template>
    </view>
    <view v-if="initialized" class="settings-save-bar">
      <text class="settings-hint" aria-live="polite">{{
        saved ? '已保存' : saving ? '正在保存…' : dirty ? '有未保存的修改' : '暂无修改'
      }}</text>
      <button
        class="settings-button settings-button--primary"
        :disabled="!canSave"
        @click="$emit('save')"
      >
        {{ saved ? '已保存' : saving ? '保存中…' : '保存修改' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean;
  initialized: boolean;
  loadError: string;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  canSave: boolean;
  restoredDraft: boolean;
}>();
defineEmits<{ (e: 'retry'): void; (e: 'save'): void }>();
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
.settings-load-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 32px 0;
}
.settings-save-bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0 calc(4px + env(safe-area-inset-bottom));
  background: #fff;
}
.settings-save-bar .settings-button {
  min-width: 120px;
}
</style>
