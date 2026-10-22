<template>
  <SettingsPage v-bind="pageState" :can-save="canSave" @retry="loadProfile" @save="handleSave">
    <view class="settings-note">{{
      t('account.settings.allergensFilterRecommendedDishesDish')
    }}</view>
    <view class="settings-section">
      <label for="allergens-input" class="settings-title">{{
        t('account.settings.allergenList')
      }}</label>
      <textarea
        id="allergens-input"
        v-model="form.allergens"
        class="settings-field allergens-input"
        :disabled="!canEdit"
        :aria-disabled="!canEdit"
        :placeholder="t('account.settings.separateMultipleAllergensWithCommas')"
        maxlength="200"
      />
      <text class="settings-hint allergens-count">{{ form.allergens.length }}/200</text>
    </view>
    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.commonAllergens') }}</text>
      <view class="settings-options">
        <button
          v-for="item in commonAllergens"
          :key="item.value"
          class="settings-button"
          hover-class="settings-button--pressed"
          :hover-stay-time="80"
          :class="{ 'settings-option--selected': isSelected(item.value) }"
          :aria-pressed="isSelected(item.value)"
          :disabled="!canEdit"
          @click="toggleAllergen(item.value)"
        >
          {{ item.label }}
        </button>
      </view>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';
import { useAllergens } from '../composables/use-allergens';
import SettingsPage from './SettingsPage.vue';
const state = useAllergens();
const {
  form,
  canEdit,
  canSave,
  loadProfile,
  commonAllergens,
  isSelected,
  toggleAllergen,
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
.allergens-input {
  height: 140px;
}
.allergens-count {
  margin-top: 8px;
  text-align: right;
}
</style>
