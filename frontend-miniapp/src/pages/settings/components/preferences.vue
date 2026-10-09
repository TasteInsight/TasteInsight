<template>
  <SettingsPage
    v-bind="pageState"
    :can-save="canSave && !priceRangeError"
    @retry="loadProfile"
    @save="handleSave"
  >
    <view class="settings-section">
      <text class="settings-title">口味偏好</text>
      <text class="settings-hint">0 表示未设置，1–5 表示偏好强度。</text>
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
      <text class="settings-title">分量</text>
      <view class="settings-options">
        <button
          v-for="(label, value) in portionLabels"
          :key="value"
          class="settings-button settings-option"
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
      <text class="settings-title">价格范围</text>
      <view class="price-fields">
        <view
          ><label for="price-min" class="settings-hint">最低价（元）</label
          ><input
            id="price-min"
            v-model.number="form.priceRange.min"
            type="digit"
            class="settings-field"
            :disabled="!canEdit"
            :aria-invalid="!!priceRangeError"
        /></view>
        <view
          ><label for="price-max" class="settings-hint">最高价（元）</label
          ><input
            id="price-max"
            v-model.number="form.priceRange.max"
            type="digit"
            class="settings-field"
            :disabled="!canEdit"
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
          :placeholder="group.placeholder"
          maxlength="30"
          @input="setDraft(group.field, $event)"
          @confirm="group.add"
        />
        <button
          class="settings-button"
          :disabled="!canEdit || !drafts[group.field].trim()"
          @click="group.add"
        >
          添加
        </button>
      </view>
      <view v-if="form[group.field].length" class="settings-tags">
        <view v-for="(item, index) in form[group.field]" :key="item" class="settings-tag">
          <text>{{ item }}</text
          ><button
            class="settings-button settings-tag-remove"
            :aria-label="'删除' + item"
            :disabled="!canEdit"
            @click="group.remove(index)"
          >
            <text class="iconfont icon-plus" aria-hidden="true"></text>
          </button>
        </view>
      </view>
    </view>

    <view class="settings-section">
      <text class="settings-title">偏好食堂</text>
      <view v-if="canteensError" class="directory-error">
        <text class="settings-error">{{ canteensError }}</text
        ><button class="settings-button" @click="loadCanteens">重试食堂列表</button>
      </view>
      <text v-else-if="canteensLoading" class="settings-hint">正在加载食堂…</text>
      <picker
        v-else
        mode="selector"
        :range="canteenList"
        range-key="name"
        :disabled="!canEdit || !canteenList.length"
        @change="onCanteenSelect"
      >
        <view class="settings-field settings-inline"
          ><text class="canteen-picker-label">{{
            canteenList.length ? '选择食堂' : '暂无可选食堂'
          }}</text
          ><text class="iconfont icon-chevronright" aria-hidden="true"></text
        ></view>
      </picker>
      <view v-if="form.canteenPreferences.length" class="settings-tags">
        <view v-for="(id, index) in form.canteenPreferences" :key="id" class="settings-tag">
          <text>{{ getCanteenNameById(id) }}</text
          ><button
            class="settings-button settings-tag-remove"
            :disabled="!canEdit"
            :aria-label="'移除' + getCanteenNameById(id)"
            @click="removeCanteenPreference(index)"
          >
            <text class="iconfont icon-plus" aria-hidden="true"></text>
          </button>
        </view>
      </view>
    </view>
  </SettingsPage>
</template>
<script setup lang="ts">
import { computed } from 'vue';
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
  dirty: state.dirty.value,
  restoredDraft: state.restoredDraft.value,
}));
const tasteOptions = [
  { field: 'spiciness', label: '辣度', labels: spicinessLabels },
  { field: 'sweetness', label: '甜度', labels: tasteLabels },
  { field: 'saltiness', label: '咸度', labels: tasteLabels },
  { field: 'oiliness', label: '油腻度', labels: tasteLabels },
] as const;
const ingredientGroups = [
  {
    field: 'favoriteIngredients',
    label: '喜好食材',
    placeholder: '输入喜好的食材',
    add: state.addFavoriteIngredient,
    remove: state.removeFavoriteIngredient,
  },
  {
    field: 'meatPreference',
    label: '肉类偏好',
    placeholder: '输入偏好的肉类',
    add: state.addMeatPreference,
    remove: state.removeMeatPreference,
  },
  {
    field: 'avoidIngredients',
    label: '不喜欢的食材',
    placeholder: '输入想避开的食材',
    add: state.addAvoidIngredient,
    remove: state.removeAvoidIngredient,
  },
] as const;
type IngredientField = (typeof ingredientGroups)[number]['field'];
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
  padding-top: 18px;
}
.taste-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.taste-row slider {
  margin: 14px 10px 0;
}
.price-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
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
.directory-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.settings-tag-remove .iconfont {
  display: inline-block;
  transform: rotate(45deg);
}
</style>
