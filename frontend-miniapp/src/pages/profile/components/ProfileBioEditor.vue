<template>
  <view class="profile-bio-editor">
    <label for="profile-bio-input" class="profile-bio-label">个人简介</label>
    <textarea
      id="profile-bio-input"
      v-model="bio"
      class="profile-bio-input"
      :disabled="saving"
      maxlength="160"
      aria-label="个人简介"
      placeholder="介绍一下自己"
      placeholder-style="color: #667085"
    />
    <text v-if="error" class="profile-bio-error" role="alert">{{ error }}</text>
    <view class="profile-bio-actions">
      <text class="profile-bio-count">{{ bio.length }} / 160</text>
      <button
        class="profile-bio-button"
        :disabled="saving"
        @click="cancelButton.activate"
        @keydown="cancelButton.handleKeydown"
        @keyup="cancelButton.handleKeyup"
        @blur="cancelButton.clearPress"
        role="button"
        :tabindex="saving ? -1 : 0"
      >
        取消
      </button>
      <button
        class="profile-bio-button profile-bio-save"
        :disabled="saving || bio.trim() === originalBio"
        @click="saveButton.activate"
        @keydown="saveButton.handleKeydown"
        @keyup="saveButton.handleKeyup"
        @blur="saveButton.clearPress"
        role="button"
        :tabindex="saving || bio.trim() === originalBio ? -1 : 0"
      >
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import { useButtonActivation } from '@/composables/use-button-activation';
const emit = defineEmits<{ (event: 'close'): void }>();
const user = useUserStore();
const originalBio = user.userInfo?.bio || '';
const bio = ref(originalBio);
const saving = ref(false);
const error = ref('');
let active = true;
const session = user.sessionVersion;
const current = () => active && session === user.sessionVersion;
const cancelButton = useButtonActivation(
  () => {
    void cancel();
  },
  () => saving.value
);
const saveButton = useButtonActivation(
  () => {
    void save();
  },
  () => saving.value || bio.value.trim() === originalBio
);
async function cancel() {
  if (saving.value) return;
  if (await confirmDiscardChanges(bio.value.trim() !== originalBio, '简介尚未保存，确定放弃吗？')) {
    if (current()) emit('close');
  }
}
async function save() {
  if (!current() || saving.value || !user.isLoggedIn || bio.value.trim() === originalBio) return;
  saving.value = true;
  error.value = '';
  try {
    await user.updateProfileAction({ bio: bio.value.trim() });
    if (current()) emit('close');
  } catch (cause) {
    if (current()) error.value = cause instanceof Error ? cause.message : '简介保存失败，请重试';
  } finally {
    if (current()) saving.value = false;
  }
}
watch(
  () => user.sessionVersion,
  () => {
    bio.value = '';
    emit('close');
  },
  { flush: 'sync' }
);
defineExpose({ cancel });
onScopeDispose(() => {
  active = false;
});
</script>
<style scoped>
.profile-bio-editor {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eaecf0;
}
.profile-bio-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}
.profile-bio-input {
  box-sizing: border-box;
  width: 100%;
  height: 120px;
  padding: 12px;
  border: 1px solid #9ca3af;
  border-radius: 8px;
  color: #1f2937;
  font-size: 15px;
  line-height: 1.7;
  caret-color: #660874;
}
.profile-bio-input:focus-within {
  border-color: #660874;
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.profile-bio-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.profile-bio-count {
  flex: 1;
  color: #667085;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.profile-bio-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 8px 14px;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #475467;
  font-size: 14px;
  line-height: 1.5;
}
.profile-bio-button::after {
  border: 0;
}
.profile-bio-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.profile-bio-button:active {
  background: #f4f4f5;
}
.profile-bio-button[disabled] {
  opacity: 0.5;
}
.profile-bio-save,
.profile-bio-save:active {
  background: #660874;
  color: #fff;
}
.profile-bio-error {
  display: block;
  margin-top: 8px;
  color: #b42318;
  font-size: 13px;
  line-height: 1.6;
}
</style>
