<template>
  <SettingsPage
    v-bind="pageState"
    :can-save="canSave && !priceRangeError"
    @retry="loadProfile"
    @save="handleSave"
  >
    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.tastePreferences') }}</text>
      <text class="settings-hint">{{ t('account.settings.section0MeansUnset15') }}</text>
      <view v-for="taste in tasteOptions" :key="taste.field" class="taste-row">
        <view class="taste-heading"
          ><text class="settings-label">{{ taste.label }}</text
          ><text class="settings-hint">{{ taste.labels[form[taste.field]] }}</text></view
        >
        <slider
          :value="form[taste.field]"
          :min="0"
          :max="5"
          :step="1"
          :disabled="!canEdit"
          activeColor="#660874"
          backgroundColor="#e5e7eb"
          :block-size="24"
          :aria-label="taste.label"
          @change="form[taste.field] = Number($event.detail.value)"
        />
      </view>
    </view>

    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.portionSize') }}</text>
      <view class="settings-options">
        <button
          v-for="(label, value) in portionLabels"
          :key="value"
          class="settings-button settings-option"
          hover-class="settings-button--pressed"
          :hover-stay-time="80"
          :class="{ 'settings-option--selected': form.portionSize === value }"
          :aria-pressed="form.portionSize === value"
          :disabled="!canEdit"
          @click="form.portionSize = value"
        >
          {{ label }}
        </button>
      </view>
    </view>

    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.priceRange') }}</text>
      <view class="price-fields">
        <view
          ><label for="price-min" class="settings-hint">{{
            t('account.settings.minimumPriceCny')
          }}</label
          ><input
            id="price-min"
            v-model.number="form.priceRange.min"
            type="digit"
            class="settings-field"
            :disabled="!canEdit"
            :aria-disabled="!canEdit"
            :aria-invalid="!!priceRangeError"
        /></view>
        <view
          ><label for="price-max" class="settings-hint">{{
            t('account.settings.maximumPriceCny')
          }}</label
          ><input
            id="price-max"
            v-model.number="form.priceRange.max"
            type="digit"
            class="settings-field"
            :disabled="!canEdit"
            :aria-disabled="!canEdit"
            :aria-invalid="!!priceRangeError"
        /></view>
      </view>
      <text v-if="priceRangeError" class="settings-error price-error">{{ priceRangeError }}</text>
    </view>

    <view v-for="group in ingredientGroups" :key="group.field" class="settings-section">
      <label :for="'ingredient-' + group.field" class="settings-title">{{ group.label }}</label>
      <view class="settings-inline">
        <input
          :id="'ingredient-' + group.field"
          :value="drafts[group.field]"
          class="settings-field"
          :disabled="!canEdit"
          :aria-disabled="!canEdit"
          :placeholder="group.placeholder"
          maxlength="30"
          @input="setDraft(group.field, $event)"
          @confirm="group.add"
        />
        <button
          class="settings-button"
          hover-class="settings-button--pressed"
          :hover-stay-time="80"
          :disabled="!canEdit || !drafts[group.field].trim()"
          @click="group.add"
        >
          {{ t('account.settings.add') }}
        </button>
      </view>
      <view v-if="form[group.field].length" class="settings-tags">
        <view v-for="(item, index) in form[group.field]" :key="item" class="settings-tag">
          <text>{{ item }}</text
          ><button
            class="settings-button settings-tag-remove"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :aria-label="t('account.settings.deleteItem', { item })"
            :disabled="!canEdit"
            @click="group.remove(index)"
          >
            <UiIcon name="close" :size="16" />
          </button>
        </view>
      </view>
    </view>

    <view class="settings-section">
      <text class="settings-title">{{ t('account.settings.preferredCanteens') }}</text>
      <view v-if="canteensError" class="directory-error error-feedback" role="alert">
        <text class="error-feedback__message">{{ canteensError }}</text
        ><button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="loadCanteens"
        >
          {{ t('account.settings.retryCanteenList') }}
        </button>
      </view>
      <text v-else-if="canteensLoading" class="settings-hint">{{
        t('account.settings.loadingCanteens')
      }}</text>
      <UiPicker
        v-else
        class="settings-picker"
        :aria-disabled="!canEdit || !canteenList.length"
        mode="selector"
        :range="canteenList"
        range-key="name"
        :disabled="!canEdit || !canteenList.length"
        @change="onCanteenSelect"
      >
        <view class="settings-field settings-inline"
          ><text class="canteen-picker-label">{{
            canteenList.length
              ? t('account.settings.chooseACanteen')
              : t('account.settings.noCanteensAvailable')
          }}</text
          ><UiIcon name="chevron-down" :size="16"
        /></view>
      </UiPicker>
      <view v-if="form.canteenPreferences.length" class="settings-tags">
        <view v-for="(id, index) in form.canteenPreferences" :key="id" class="settings-tag">
          <text>{{ getCanteenNameById(id) }}</text
          ><button
            class="settings-button settings-tag-remove"
            hover-class="settings-button--pressed"
            :hover-stay-time="80"
            :disabled="!canEdit"
            :aria-label="t('account.settings.removeItem', { item: getCanteenNameById(id) })"
            @click="removeCanteenPreference(index)"
          >
            <UiIcon name="close" :size="16" />
          </button>
        </view>
      </view>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed } from 'vue';
import UiPicker from '@/components/UiPicker.vue';
import UiIcon from '@/components/UiIcon.vue';
import { onBackPress } from '@dcloudio/uni-app';
import { usePreferences } from '../composables/use-preferences';
import SettingsPage from './SettingsPage.vue';
const state = usePreferences();
const {
  form,
  canEdit,
  canSave,
  loadProfile,
  handleSave,
  handleBackPress,
  priceRangeError,
  canteenList,
  canteensLoading,
  canteensError,
  loadCanteens,
  onCanteenSelect,
  getCanteenNameById,
  removeCanteenPreference,
  portionLabels,
  tasteLabels,
  spicinessLabels,
} = state;
const pageState = computed(() => ({
  loading: state.loading.value,
  initialized: state.initialized.value,
  loadError: state.loadError.value,
  saving: state.saving.value,
  saved: state.saved.value,
  restoredDraft: state.restoredDraft.value,
}));
const tasteOptions = computed(
  () =>
    [
      { field: 'spiciness', label: t('account.settings.spiciness'), labels: spicinessLabels.value },
      { field: 'sweetness', label: t('account.settings.sweetness'), labels: tasteLabels.value },
      { field: 'saltiness', label: t('account.settings.saltiness'), labels: tasteLabels.value },
      { field: 'oiliness', label: t('account.settings.oiliness'), labels: tasteLabels.value },
    ] as const
);
const ingredientGroups = computed(
  () =>
    [
      {
        field: 'favoriteIngredients',
        label: t('account.settings.favoriteIngredients2'),
        placeholder: t('account.settings.enterAFavoriteIngredient'),
        add: state.addFavoriteIngredient,
        remove: state.removeFavoriteIngredient,
      },
      {
        field: 'meatPreference',
        label: t('account.settings.meatPreferences'),
        placeholder: t('account.settings.enterAPreferredMeat'),
        add: state.addMeatPreference,
        remove: state.removeMeatPreference,
      },
      {
        field: 'avoidIngredients',
        label: t('account.settings.dislikedIngredients'),
        placeholder: t('account.settings.enterAnIngredientToAvoid'),
        add: state.addAvoidIngredient,
        remove: state.removeAvoidIngredient,
      },
    ] as const
);
type IngredientField = (typeof ingredientGroups.value)[number]['field'];
const draftRefs = {
  favoriteIngredients: state.newFavoriteIngredient,
  meatPreference: state.newMeatPreference,
  avoidIngredients: state.newAvoidIngredient,
};
const drafts = computed(() => ({
  favoriteIngredients: state.newFavoriteIngredient.value,
  meatPreference: state.newMeatPreference.value,
  avoidIngredients: state.newAvoidIngredient.value,
}));
function setDraft(field: IngredientField, event: Event) {
  draftRefs[field].value = (event as unknown as { detail: { value: string } }).detail.value;
}
onBackPress(handleBackPress);
</script>
<style scoped>
.taste-row {
  padding-top: 16px;
}
.taste-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.taste-row slider {
  margin: 12px 10px 0;
}
.price-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}
.price-fields .settings-hint {
  margin-bottom: 8px;
}
.price-error {
  margin-top: 8px;
}
.canteen-picker-label {
  flex: 1;
}
</style>
