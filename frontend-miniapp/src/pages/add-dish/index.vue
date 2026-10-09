<template>
  <view class="add-dish-page page-content">
    <view v-if="submitted" class="submission-success" role="status">
      <text class="success-title">提交成功</text>
      <text>菜品信息已送交审核，即将返回。</text>
    </view>
    <view class="form-intro">填写菜品信息，带 * 的项目为必填项。</view>
    <view class="form-section">
      <text class="section-title">基本信息</text>
      <view id="field-name" class="form-field">
        <label for="dish-name" class="field-label">菜品名称 *</label>
        <input
          id="dish-name"
          v-model="formData.name"
          class="form-input"
          aria-label="菜品名称"
          placeholder="例如：番茄炒蛋"
          :disabled="busy"
        />
        <text v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</text>
      </view>
      <view id="field-price" class="form-field">
        <label for="dish-price" class="field-label">价格 *</label>
        <view class="price-fields">
          <view class="price-value"
            ><text>¥</text
            ><input
              id="dish-price"
              v-model.number="formData.price"
              class="form-input"
              type="digit"
              aria-label="菜品价格"
              placeholder="0.00"
              :disabled="busy"
          /></view>
          <text class="price-divider">/</text
          ><input
            v-model="formData.priceUnit"
            class="form-input price-unit"
            aria-label="价格单位"
            placeholder="份"
            :disabled="busy"
          />
        </view>
        <text class="field-hint">价格可为 0；单位选填，例如份、碗、两。</text>
        <text v-if="fieldErrors.price" class="field-error">{{ fieldErrors.price }}</text>
      </view>
      <view class="form-field">
        <label for="dish-description" class="field-label">菜品介绍</label>
        <textarea
          id="dish-description"
          v-model="formData.description"
          class="form-input description-input"
          aria-label="菜品介绍"
          placeholder="介绍口味、分量或主要食材（选填）"
          :disabled="busy"
        />
      </view>
    </view>

    <view class="form-section">
      <text class="section-title">位置与供应</text>
      <view id="field-canteen" class="form-field">
        <text class="field-label">所在食堂 *</text>
        <text v-if="loading" class="field-hint">正在加载食堂…</text>
        <view v-else-if="canteenError" class="location-state">
          <text class="field-error">{{ canteenError }}</text
          ><button class="text-action" @tap="loadCanteenList">重新加载</button>
        </view>
        <view v-else-if="!canteenList.length" class="location-state">
          <text class="field-hint">暂时没有可选食堂。</text
          ><button class="text-action" @tap="loadCanteenList">刷新食堂</button>
        </view>
        <view v-else class="location-grid">
          <button
            v-for="canteen in canteenList"
            :key="canteen.id"
            class="choice location-choice"
            :class="{ 'is-selected': selectedCanteen?.id === canteen.id }"
            :aria-pressed="selectedCanteen?.id === canteen.id"
            :disabled="busy"
            @tap="selectCanteen(canteen)"
          >
            {{ canteen.name }}
          </button>
        </view>
        <text v-if="fieldErrors.canteen" class="field-error">{{ fieldErrors.canteen }}</text>
      </view>
      <view v-if="selectedCanteen" class="form-field">
        <text class="field-label">所在窗口（选填）</text>
        <view v-if="windowList.length" class="location-grid">
          <button
            class="choice location-choice"
            :class="{ 'is-selected': !formData.windowId }"
            :aria-pressed="!formData.windowId"
            :disabled="busy"
            @tap="clearWindow"
          >
            暂不选择
          </button>
          <button
            v-for="window in windowList"
            :key="window.id"
            class="choice location-choice"
            :class="{ 'is-selected': formData.windowId === window.id }"
            :aria-pressed="formData.windowId === window.id"
            :disabled="busy"
            @tap="selectWindow(window)"
          >
            <text>{{ window.name }}</text
            ><text v-if="window.floor" class="window-floor">{{
              window.floor.name || window.floor.level + '楼'
            }}</text>
          </button>
        </view>
        <text v-else class="field-hint">该食堂暂无窗口信息，可直接提交到食堂。</text>
      </view>
      <view id="field-availableMealTime" class="form-field">
        <text class="field-label">供应时段 *</text>
        <view class="choice-list">
          <button
            v-for="option in mealTimeOptions"
            :key="option.value"
            class="choice"
            :class="{ 'is-selected': formData.availableMealTime.includes(option.value as any) }"
            :aria-pressed="formData.availableMealTime.includes(option.value as any)"
            :disabled="busy"
            @tap="toggleMealTime(option.value as any)"
          >
            {{ option.label }}
          </button>
        </view>
        <text v-if="fieldErrors.availableMealTime" class="field-error">{{
          fieldErrors.availableMealTime
        }}</text>
      </view>
    </view>

    <view class="form-section">
      <text class="section-title">菜品图片</text>
      <text class="field-hint">最多 9 张，提交菜品时上传。</text>
      <view class="image-list">
        <view v-for="(image, index) in formData.images" :key="image" class="image-item">
          <image :src="image" class="dish-image" mode="aspectFill" @tap="previewImage(index)" />
          <button
            class="text-action image-remove"
            :aria-label="'移除第 ' + (index + 1) + ' 张图片'"
            :disabled="busy"
            @tap="removeImage(index)"
          >
            移除
          </button>
        </view>
        <button
          v-if="!formData.images || formData.images.length < 9"
          class="image-add"
          :disabled="busy"
          @tap="chooseImages"
        >
          添加图片
        </button>
      </view>
    </view>

    <view class="form-section">
      <text class="section-title">菜品标签</text>
      <view class="choice-list">
        <button
          v-for="tag in commonTags"
          :key="tag"
          class="choice badge-choice"
          :class="{ 'is-selected': formData.tags?.includes(tag) }"
          :aria-pressed="formData.tags?.includes(tag)"
          :disabled="busy"
          @tap="toggleTag(tag)"
        >
          {{ tag }}
        </button>
      </view>
      <view class="custom-input">
        <input
          v-model="customTagInput"
          class="form-input"
          aria-label="自定义标签"
          placeholder="添加自定义标签"
          :disabled="busy"
          @confirm="addCustomTag"
        />
        <button class="text-action" :disabled="busy || !customTagInput.trim()" @tap="addCustomTag">
          添加
        </button>
      </view>
      <view v-if="customTags.length" class="custom-tags">
        <view v-for="tag in customTags" :key="tag" class="custom-tag"
          ><text>{{ tag }}</text
          ><button
            class="text-action"
            :aria-label="'移除标签 ' + tag"
            :disabled="busy"
            @tap="removeCustomTag(tag)"
          >
            移除
          </button></view
        >
      </view>
    </view>

    <view class="form-section">
      <text class="section-title">已知过敏原</text>
      <text class="field-hint">仅填写已了解的原料信息；不确定时可留空。</text>
      <view class="choice-list">
        <button
          v-for="allergen in commonAllergens"
          :key="allergen"
          class="choice badge-choice"
          :class="{ 'is-selected': formData.allergens?.includes(allergen) }"
          :aria-pressed="formData.allergens?.includes(allergen)"
          :disabled="busy"
          @tap="toggleAllergen(allergen)"
        >
          {{ allergen }}
        </button>
      </view>
      <view class="custom-input">
        <input
          v-model="customAllergenInput"
          class="form-input"
          aria-label="自定义过敏原"
          placeholder="添加自定义过敏原"
          :disabled="busy"
          @confirm="addCustomAllergen"
        />
        <button
          class="text-action"
          :disabled="busy || !customAllergenInput.trim()"
          @tap="addCustomAllergen"
        >
          添加
        </button>
      </view>
      <view v-if="customAllergens.length" class="custom-tags">
        <view v-for="allergen in customAllergens" :key="allergen" class="custom-tag"
          ><text>{{ allergen }}</text
          ><button
            class="text-action"
            :aria-label="'移除过敏原 ' + allergen"
            :disabled="busy"
            @tap="removeCustomAllergen(allergen)"
          >
            移除
          </button></view
        >
      </view>
    </view>

    <view class="submit-bar" :style="keyboardStyle">
      <text v-if="error" class="field-error submit-error">{{ error }}</text>
      <button class="submit-button" :disabled="busy || leaving" @tap="handleSubmit">
        {{ submitted ? '已提交，等待审核' : submitting ? '提交中…' : '提交菜品' }}
      </button>
      <text class="field-hint submit-hint">提交后由管理员审核</text>
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <page-container
      v-if="renderBackHelper"
      :key="backHelperKey"
      :show="dirty || submitting"
      :overlay="false"
      :duration="0"
      custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="handleBackHelperLeave"
      @afterleave="restoreBackHelper"
    />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted, nextTick } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';
import { useAddDish } from './composables/use-add-dish';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import { useUserStore } from '@/store/modules/use-user-store';
import { useSheetKeyboard } from '@/pages/dish/composables/use-sheet-keyboard';

const {
  formData,
  canteenList,
  windowList,
  selectedCanteen,
  loading,
  submitting,
  submitted,
  busy,
  dirty,
  fieldErrors,
  canteenError,
  error,
  mealTimeOptions,
  commonTags,
  commonAllergens,
  customTagInput,
  customAllergenInput,
  customTags,
  customAllergens,
  loadCanteenList,
  selectCanteen,
  selectWindow,
  clearWindow,
  toggleMealTime,
  toggleTag,
  addCustomTag,
  removeCustomTag,
  toggleAllergen,
  addCustomAllergen,
  removeCustomAllergen,
  chooseImages,
  removeImage,
  submitForm,
  markPristine,
} = useAddDish();
const userStore = useUserStore();
const keyboardStyle = useSheetKeyboard();
const leaving = ref(false);
const backHelperKey = ref(0);
const renderBackHelper = ref(true);
let active = true;
let allowLeave = false;
onUnmounted(() => {
  active = false;
});
onMounted(() => {
  void loadCanteenList();
  const pages = getCurrentPages();
  const options = (pages[pages.length - 1] as any)?.options || {};
  if (options.keyword) formData.name = decodeURIComponent(options.keyword);
  markPristine();
});
const previewImage = (index: number) =>
  uni.previewImage({ urls: formData.images || [], current: formData.images![index] });
const handleSubmit = async () => {
  if (await submitForm()) return;
  const field = Object.keys(fieldErrors.value)[0];
  if (field) {
    await nextTick();
    uni.pageScrollTo({ selector: '#field-' + field, duration: 200 });
  }
};
const requestLeave = async () => {
  if (submitting.value || leaving.value) return false;
  const session = userStore.sessionVersion;
  leaving.value = true;
  try {
    if (!(await confirmDiscardChanges(dirty.value, '菜品信息尚未提交，确定放弃吗？'))) return false;
    if (!active || session !== userStore.sessionVersion) return false;
    allowLeave = true;
    renderBackHelper.value = false;
    await nextTick();
    uni.navigateBack();
    return true;
  } finally {
    leaving.value = false;
  }
};
const restoreBackHelper = () => {
  if (active && !allowLeave && (dirty.value || submitting.value)) backHelperKey.value++;
};
const handleBackHelperLeave = () => {
  if (dirty.value || submitting.value) void requestLeave();
};
onBackPress(() => {
  if (allowLeave || (!dirty.value && !submitting.value)) return false;
  void requestLeave();
  return true;
});
</script>

<style scoped>
.add-dish-page {
  padding: 0 20px calc(128px + env(safe-area-inset-bottom));
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}
.form-intro {
  padding: 20px 0 0;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}
.form-section {
  padding: 24px 0;
  border-bottom: 1px solid #e5e7eb;
}
.section-title {
  display: block;
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}
.form-field + .form-field {
  margin-top: 20px;
}
.field-label {
  display: block;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}
.form-input {
  width: 100%;
  min-width: 0;
  height: 48px;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #d0d5dd;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-size: 16px;
  color: #1f2937;
  line-height: 1.5;
}
.form-input:focus,
.form-input:focus-within {
  outline: 2px solid #660874;
  outline-offset: 1px;
}
.description-input {
  height: 120px;
}
.field-hint {
  display: block;
  margin-top: 6px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}
.field-error {
  display: block;
  margin-top: 8px;
  color: #b42318;
  font-size: 14px;
  line-height: 1.5;
}
.price-fields,
.price-value,
.custom-input {
  display: flex;
  align-items: center;
  gap: 10px;
}
.price-value {
  flex: 1;
  min-width: 0;
}
.price-value .form-input {
  flex: 1;
}
.price-divider {
  color: #667085;
}
.price-unit {
  flex: 0 0 64px;
  width: 64px;
  text-align: center;
}
.location-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.choice-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.choice {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #475467;
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.location-choice {
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 10px 12px;
}
.window-floor {
  display: block;
  font-size: 13px;
  color: #667085;
  margin-top: 2px;
}
.badge-choice {
  border-radius: 999px;
  background: #f4f4f5;
}
.choice.is-selected {
  border-color: #660874;
  color: #660874;
}
.choice:focus-visible,
.text-action:focus-visible,
.image-add:focus-visible,
.submit-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
button::after {
  border: 0;
}
button[disabled] {
  opacity: 0.6;
}
.text-action {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 8px;
  background: #fff;
  color: #660874;
  font-size: 14px;
  line-height: 1.5;
}
.location-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.image-list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-top: 16px;
}
.image-item,
.dish-image {
  width: 80px;
}
.dish-image {
  display: block;
  height: 80px;
  border-radius: 10px;
}
.image-remove {
  width: 80px;
  color: #667085;
}
.image-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin: 0;
  padding: 8px;
  box-sizing: border-box;
  border: 1px dashed #98a2b3;
  border-radius: 10px;
  background: #fff;
  color: #475467;
  font-size: 14px;
  line-height: 1.5;
}
.custom-input {
  margin-top: 16px;
}
.custom-input .form-input {
  flex: 1;
}
.custom-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.custom-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding-left: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.submit-bar {
  position: fixed;
  z-index: 1000;
  right: 0;
  bottom: var(--window-bottom, 0px);
  left: 0;
  padding: 12px 20px calc(12px + var(--sheet-safe-bottom, env(safe-area-inset-bottom)));
  box-sizing: border-box;
  background: #fff;
  border-top: 1px solid #e5e7eb;
}
.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 10px 16px;
  background: #660874;
  color: #fff;
  border: 0;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}
.submit-hint {
  text-align: center;
}
.submit-error {
  margin: 0 0 8px;
}
.submission-success {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 0 0;
  color: #475467;
  font-size: 14px;
  line-height: 1.6;
}
.success-title {
  color: #1f2937;
  font-size: 20px;
  font-weight: 600;
}
@media (max-width: 340px) {
  .add-dish-page {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
