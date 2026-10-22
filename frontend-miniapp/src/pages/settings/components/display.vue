<template>
  <SettingsPage v-bind="pageState" :can-save="canSave" @retry="loadProfile" @save="handleSave">
    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.displayOptions') }}</text>
      <label class="settings-choice-label">
        <view
          class="settings-row settings-choice-row list-row-action"
          :hover-class="canEdit ? 'list-row-pressed' : 'none'"
          :hover-stay-time="80"
          :aria-disabled="!canEdit"
        >
          <view
            ><text class="settings-label">{{ t('account.settings.showCalories') }}</text
            ><text class="settings-hint">{{
              t('account.settings.showAvailableCaloriesPerServing')
            }}</text></view
          >
          <view class="settings-switch-control">
            <switch
              class="settings-switch"
              :checked="form.showCalories"
              role="switch"
              :aria-checked="form.showCalories"
              :aria-disabled="!canEdit"
              :tabindex="canEdit ? 0 : -1"
              @keydown="caloriesSwitch.handleKeydown"
              @keyup="caloriesSwitch.handleKeyup"
              @blur="caloriesSwitch.clearPress"
              :disabled="!canEdit"
              color="#660874"
              :aria-label="t('account.settings.showCalories')"
              @change="onShowCaloriesChange"
            />
          </view>
        </view>
      </label>
      <label class="settings-choice-label">
        <view
          class="settings-row settings-choice-row list-row-action"
          :hover-class="canEdit ? 'list-row-pressed' : 'none'"
          :hover-stay-time="80"
          :aria-disabled="!canEdit"
        >
          <view
            ><text class="settings-label">{{ t('account.settings.showNutrition') }}</text
            ><text class="settings-hint">{{
              t('account.settings.showAvailableProteinCarbohydratesAnd')
            }}</text></view
          >
          <view class="settings-switch-control">
            <switch
              class="settings-switch"
              :checked="form.showNutrition"
              role="switch"
              :aria-checked="form.showNutrition"
              :aria-disabled="!canEdit"
              :tabindex="canEdit ? 0 : -1"
              @keydown="nutritionSwitch.handleKeydown"
              @keyup="nutritionSwitch.handleKeyup"
              @blur="nutritionSwitch.clearPress"
              :disabled="!canEdit"
              color="#660874"
              :aria-label="t('account.settings.showNutrition')"
              @change="onShowNutritionChange"
            />
          </view>
        </view>
      </label>
    </view>
    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.defaultSortOrder') }}</text>
      <UiPicker
        class="settings-picker"
        :aria-disabled="!canEdit"
        mode="selector"
        :range="sortOptions"
        :value="form.sortByIndex"
        :disabled="!canEdit"
        @change="onSortChange"
      >
        <view class="settings-field settings-inline"
          ><text class="sort-label">{{ sortOptions[form.sortByIndex] }}</text
          ><UiIcon name="chevron-down" :size="16"
        /></view>
      </UiPicker>
      <text class="settings-hint sort-hint">{{ t('account.settings.usedAsTheInitialOrder') }}</text>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed } from 'vue';
import { useButtonActivation } from '@/composables/use-button-activation';
import UiPicker from '@/components/UiPicker.vue';
import UiIcon from '@/components/UiIcon.vue';
import { onBackPress } from '@dcloudio/uni-app';
import { useDisplay } from '../composables/use-display';
import SettingsPage from './SettingsPage.vue';
const state = useDisplay();
const {
  form,
  canEdit,
  canSave,
  loadProfile,
  sortOptions,
  onShowCaloriesChange,
  onShowNutritionChange,
  onSortChange,
  handleSave,
  handleBackPress,
} = state;
const caloriesSwitch = useButtonActivation(
  () => onShowCaloriesChange(!form.showCalories),
  () => !canEdit.value
);
const nutritionSwitch = useButtonActivation(
  () => onShowNutritionChange(!form.showNutrition),
  () => !canEdit.value
);
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
.sort-label {
  flex: 1;
}
.sort-hint {
  margin-top: 8px;
}
</style>
