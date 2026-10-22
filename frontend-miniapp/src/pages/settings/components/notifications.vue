<template>
  <SettingsPage v-bind="pageState" :can-save="canSave" @retry="loadProfile" @save="handleSave">
    <view class="settings-section">
      <label v-for="item in notificationOptions" :key="item.key" class="settings-choice-label">
        <view
          class="settings-row settings-choice-row list-row-action"
          :hover-class="canEdit ? 'list-row-pressed' : 'none'"
          :hover-stay-time="80"
          :aria-disabled="!canEdit"
        >
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
      </label>
    </view>
    <text class="settings-hint">{{
      t('account.settings.manageYourNotificationPreferencesHere')
    }}</text>
  </SettingsPage>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
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
  restoredDraft: state.restoredDraft.value,
}));
const notificationOptions = computed(
  () =>
    [
      {
        key: 'newDishAlert',
        label: t('account.settings.newDishAlerts'),
        description: t('account.settings.notifyMeWhenACanteen'),
      },
      {
        key: 'priceChangeAlert',
        label: t('account.settings.priceChangeAlerts'),
        description: t('account.settings.notifyMeWhenThePrice'),
      },
      {
        key: 'reviewReplyAlert',
        label: t('account.settings.reviewReplyAlerts2'),
        description: t('account.settings.notifyMeWhenSomeoneReplies'),
      },
      {
        key: 'likeAlert',
        label: t('account.settings.likeAlerts'),
        description: t('account.settings.someoneLikedYourReviewPost'),
      },
      {
        key: 'postReplyAlert',
        label: t('account.settings.postReplyAlerts'),
        description: t('account.settings.someoneRepliedToYourPost'),
      },
      {
        key: 'diningAlert',
        label: t('account.settings.diningInvitationAlerts'),
        description: t('account.settings.joinRequestsInvitationResultsAnd'),
      },
      {
        key: 'weeklyRecommendation',
        label: t('account.settings.weeklyRecommendations'),
        description: t('account.settings.recommendPopularDishesEachWeek'),
      },
    ] as const
);
onBackPress(handleBackPress);
</script>
