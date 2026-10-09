<template>
  <SettingsPage v-bind="pageState" :can-save="canSave" @retry="loadProfile" @save="handleSave">
    <view class="settings-note"
      >过敏原用于过滤推荐菜品。菜品资料可能不完整，就餐前请向窗口核对食材及交叉接触情况。</view
    >
    <view class="settings-section">
      <label for="allergens-input" class="settings-title">过敏原列表</label>
      <textarea
        id="allergens-input"
        v-model="form.allergens"
        class="settings-field allergens-input"
        :disabled="!canEdit"
        placeholder="多个过敏原用逗号分隔"
        maxlength="200"
      />
      <text class="settings-hint allergens-count">{{ form.allergens.length }}/200</text>
    </view>
    <view class="settings-section">
      <text class="settings-title">常见过敏原</text>
      <view class="settings-options">
        <button
          v-for="item in commonAllergens"
          :key="item"
          class="settings-button"
          :class="{ 'settings-option--selected': isSelected(item) }"
          :aria-pressed="isSelected(item)"
          :disabled="!canEdit"
          @click="toggleAllergen(item)"
        >
          {{ item }}
        </button>
      </view>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
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
  dirty: state.dirty.value,
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
