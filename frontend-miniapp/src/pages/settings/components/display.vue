<template>
  <SettingsPage v-bind="pageState" :can-save="canSave" @retry="loadProfile" @save="handleSave">
    <view class="settings-section">
      <text class="settings-title">显示选项</text>
      <view class="settings-row">
        <view
          ><text class="settings-label">显示卡路里</text
          ><text class="settings-hint">热量数据待接入</text></view
        >
        <switch
          :checked="form.showCalories"
          :disabled="!canEdit"
          color="#660874"
          aria-label="显示卡路里"
          @change="onShowCaloriesChange"
        />
      </view>
      <view class="settings-row">
        <view
          ><text class="settings-label">显示营养信息</text
          ><text class="settings-hint">营养数据待接入</text></view
        >
        <switch
          :checked="form.showNutrition"
          :disabled="!canEdit"
          color="#660874"
          aria-label="显示营养信息"
          @change="onShowNutritionChange"
        />
      </view>
    </view>
    <view class="settings-section">
      <text class="settings-title">默认排序方式</text>
      <picker
        mode="selector"
        :range="sortOptions"
        :value="form.sortByIndex"
        :disabled="!canEdit"
        @change="onSortChange"
      >
        <view class="settings-field settings-inline"
          ><text class="sort-label">{{ sortOptions[form.sortByIndex] }}</text
          ><text class="iconfont icon-chevronright" aria-hidden="true"></text
        ></view>
      </picker>
      <text class="settings-hint sort-hint">用于菜品列表的初始排序</text>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
import { computed } from 'vue';
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
.sort-label {
  flex: 1;
}
.sort-hint {
  margin-top: 8px;
}
</style>
