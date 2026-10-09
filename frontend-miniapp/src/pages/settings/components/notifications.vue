<template>
  <SettingsPage v-bind="pageState" :can-save="canSave" @retry="loadProfile" @save="handleSave">
    <view class="settings-section">
      <view v-for="item in notificationOptions" :key="item.key" class="settings-row">
        <view
          ><text class="settings-label">{{ item.label }}</text
          ><text class="settings-hint">{{ item.description }}</text></view
        >
        <switch
          :checked="form[item.key]"
          :disabled="!canEdit"
          color="#660874"
          :aria-label="item.label"
          @change="updateField(item.key, $event)"
        />
      </view>
    </view>
    <text class="settings-hint">您可以随时在此处管理通知偏好设置</text>
  </SettingsPage>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';
import { useNotifications } from '../composables/use-notifications';
import SettingsPage from './SettingsPage.vue';
const state = useNotifications();
const { form, canEdit, canSave, loadProfile, updateField, handleSave, handleBackPress } = state;
const pageState = computed(() => ({
  loading: state.loading.value,
  initialized: state.initialized.value,
  loadError: state.loadError.value,
  saving: state.saving.value,
  saved: state.saved.value,
  dirty: state.dirty.value,
  restoredDraft: state.restoredDraft.value,
}));
const notificationOptions = [
  { key: 'newDishAlert', label: '新菜品提醒', description: '当食堂上架新菜品时通知您' },
  { key: 'priceChangeAlert', label: '价格变动提醒', description: '当收藏菜品价格变动时通知您' },
  { key: 'reviewReplyAlert', label: '评价回复提醒', description: '当您的评价收到回复时通知您' },
  { key: 'weeklyRecommendation', label: '每周推荐', description: '每周为您推荐本周热门菜品' },
] as const;
onBackPress(handleBackPress);
</script>
