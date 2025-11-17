<template>
  <view class="w-full h-[812px] bg-white flex shadow-lg flex-col relative" style="max-width: 375px;">
    
    <scroll-view scroll-y style="flex: 1; height: 0;" class="bg-gradient-to-b from-white via-purple-50/30 to-white">
      <view class="px-6 py-6">
        <view v-if="loading" class="mt-20 flex justify-center text-sm text-gray-500">
          <text>加载中...</text>
        </view>
        <SettingsForm
          v-else
          :form="form"
          :saving="saving"
          :can-submit="canSubmit"
          :avatar-preview="avatarPreview"
          @update-field="payload => handleFieldChange(payload.field, payload.value)"
          @save="handleSave"
          @logout="handleLogout"
        />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import SettingsForm from './components/SettingsForm.vue';
import { useSettings } from './composables/use-settings';

const {
  loading,
  saving,
  form,
  canSubmit,
  avatarPreview,
  handleFieldChange,
  handleSave,
  handleLogout,
} = useSettings();
</script>
