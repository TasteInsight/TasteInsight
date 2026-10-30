<template>
  <view
    class="add-dish-page page-content page-state-layout"
    :class="{ 'add-dish-page--state': !userStore.isLoggedIn }"
  >
    <EmptyState
      v-if="!userStore.isLoggedIn"
      class="page-state-region"
      :title="t('food.signInToSuggestADish')"
      icon="edit"
      :action-text="t('food.signIn')"
      @action="openLogin"
    />
    <EmptyState
      v-else-if="!userStore.userInfo?.capabilities?.canContribute"
      class="page-state-region"
      :title="t('food.verifyYourIdentityToSuggestDishes')"
      :description="t('food.verifyYourCampusIdentityToSuggestANew')"
      icon="shield"
      :action-text="t('food.verifyIdentity')"
      @action="openIdentity"
    />
    <view v-else-if="initializationError" class="error-feedback page-state-region" role="alert">
      <text class="error-feedback__message">{{ initializationError }}</text>
      <button
        class="error-feedback__action"
        hover-class="error-feedback__action--pressed"
        @tap="initialize()"
      >
        {{ t('food.reload') }}
      </button>
    </view>
    <AsyncState
      v-else-if="initializing"
      loading
      :loading-title="t('food.loadingDishInformation')"
    />
    <template v-else>
      <view v-if="submitted" class="submission-success" role="status">
        <text class="success-title">{{
          targetDishId ? t('food.updateSubmitted') : t('food.submissionSent')
        }}</text>
        <text>{{
          targetDishId ? t('food.updateReviewRedirect') : t('food.newDishReviewRedirect')
        }}</text>
      </view>
      <text v-if="rejectionReason" class="field-error">{{
        t('food.rejectionReasonText', { reason: rejectionReason })
      }}</text>
      <text v-if="readOnly" class="field-error">{{
        t('food.thisRecordIsReadOnlyCheckItsStatus')
      }}</text>
      <view v-if="conflict" id="contribution-conflict" role="alert" class="conflict-state">
        <text class="field-error">{{
          conflict === 'target'
            ? t('food.theDishHasChangedYourDraftIsSaved')
            : conflict === 'upload'
              ? t('food.theUploadOrDishHasChangedDiscardLocal')
              : t('food.anUploadAlreadyExistsCheckMyUploadsFirst')
        }}</text>
        <button
          v-if="canDiscardDraft"
          class="text-action draft-discard"
          :disabled="leaving"
          @tap="discardDraft"
        >
          {{ t('food.discardDraftAndReloadLatestDetails') }}
        </button>
      </view>
      <button
        v-if="readOnly || conflict === 'upload' || conflict === 'request'"
        class="text-action"
        @tap="openMyUploads"
      >
        {{ t('food.viewMyUploads') }}
      </button>
      <text v-if="awaitingConfirmation" class="field-hint" role="status">{{
        t('food.submissionStatusIsPendingRetrySafelyToConfirm')
      }}</text>
      <view class="form-section">
        <view id="field-name" class="form-field">
          <label for="dish-name" class="field-label"
            >{{ t('food.dishName')
            }}<text class="required-marker" aria-hidden="true">*</text></label
          >
          <input
            id="dish-name"
            v-model="formData.name"
            class="form-input"
            :aria-label="t('food.dishName')"
            aria-required="true"
            :placeholder="t('food.forExampleTomatoAndScrambledEggs')"
            :disabled="formLocked"
          />
          <text v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</text>
        </view>
        <view class="form-field"
          ><label for="dish-name-en" class="field-label">{{ t('food.englishName') }}</label
          ><input
            id="dish-name-en"
            v-model="formData.nameEn"
            class="form-input"
            maxlength="200"
            :disabled="formLocked"
        /></view>
        <view class="form-field"
          ><label for="dish-description-en" class="field-label">{{
            t('food.englishDescription')
          }}</label
          ><textarea
            id="dish-description-en"
            v-model="formData.descriptionEn"
            class="form-input description-input"
            maxlength="4000"
            :disabled="formLocked"
          />
        </view>
        <view id="field-price" class="form-field">
          <label for="dish-price" class="field-label"
            >{{ t('food.price') }}<text class="required-marker" aria-hidden="true">*</text></label
          >
          <view class="price-fields">
            <view class="price-value"
              ><text>¥</text
              ><input
                id="dish-price"
                v-model.number="formData.price"
                class="form-input"
                type="digit"
                :aria-label="t('food.dishPrice')"
                aria-required="true"
                placeholder="0.00"
                :disabled="formLocked"
            /></view>
            <text class="price-divider">/</text
            ><input
              v-model="formData.priceUnit"
              class="form-input price-unit"
              :aria-label="t('food.priceUnit')"
              :placeholder="t('food.serving')"
              :disabled="formLocked"
            />
          </view>
          <text v-if="fieldErrors.price" class="field-error">{{ fieldErrors.price }}</text>
        </view>
      </view>

      <view class="form-section">
        <text class="section-title">{{ t('food.locationAndAvailability') }}</text>
        <view id="field-canteen" class="form-field">
          <text class="field-label" :aria-label="t('food.canteenRequired')"
            >{{ t('food.canteen') }}<text class="required-marker" aria-hidden="true">*</text></text
          >
          <text v-if="targetDishId" class="field-hint">{{
            t('food.fixedCanteen', { canteen: formData.canteenName })
          }}</text>
          <text v-else-if="loading" class="field-hint">{{ t('food.loadingCanteen') }}</text>
          <view v-else-if="canteenError" class="error-feedback" role="alert">
            <text class="error-feedback__message">{{ canteenError }}</text
            ><button
              class="error-feedback__action"
              hover-class="error-feedback__action--pressed"
              @tap="loadCanteenList"
            >
              {{ t('food.reload') }}
            </button>
          </view>
          <view v-else-if="!canteenList.length" class="location-state">
            <text class="field-hint">{{ t('food.noCanteensAvailableYet') }}</text
            ><button class="text-action" @tap="loadCanteenList">
              {{ t('food.refreshCanteens') }}
            </button>
          </view>
          <view v-else class="location-grid">
            <button
              v-for="canteen in canteenList"
              :key="canteen.id"
              class="choice location-choice"
              :class="{ 'is-selected': selectedCanteen?.id === canteen.id }"
              :aria-pressed="selectedCanteen?.id === canteen.id"
              :disabled="formLocked"
              @tap="selectCanteen(canteen)"
            >
              {{ canteen.name }}
            </button>
          </view>
          <text v-if="fieldErrors.canteen" class="field-error">{{ fieldErrors.canteen }}</text>
        </view>
        <view v-if="selectedCanteen" class="form-field">
          <text class="field-label">{{ t('food.counterOptional') }}</text>
          <view v-if="windowList.length" class="location-grid">
            <button
              class="choice location-choice"
              :class="{ 'is-selected': !formData.windowId }"
              :aria-pressed="!formData.windowId"
              :disabled="formLocked"
              @tap="clearWindow"
            >
              {{ t('food.skipForNow') }}
            </button>
            <button
              v-for="window in windowList"
              :key="window.id"
              class="choice location-choice"
              :class="{ 'is-selected': formData.windowId === window.id }"
              :aria-pressed="formData.windowId === window.id"
              :disabled="formLocked"
              @tap="selectWindow(window)"
            >
              <text>{{ window.name }}</text
              ><text v-if="window.floor" class="window-floor">{{
                window.floor.name || t('food.floorNumber', { floor: window.floor.level })
              }}</text>
            </button>
          </view>
          <text v-else class="field-hint">{{
            t('food.noCounterInformationIsAvailableYouCanSubmit')
          }}</text>
        </view>
        <view id="field-availableMealTime" class="form-field">
          <text class="field-label" :aria-label="t('food.mealTimesRequired')"
            >{{ t('food.mealTimes2')
            }}<text class="required-marker" aria-hidden="true">*</text></text
          >
          <view class="choice-list">
            <button
              v-for="option in mealTimeOptions"
              :key="option.value"
              class="choice"
              :class="{ 'is-selected': formData.availableMealTime.includes(option.value as any) }"
              :aria-pressed="formData.availableMealTime.includes(option.value as any)"
              :disabled="formLocked"
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
        <view class="section-heading"
          ><text class="section-title">{{
            targetDishId ? t('food.addPhotos2') : t('food.dishPhotos')
          }}</text
          ><text class="image-count">{{ formData.images?.length || 0 }}/9</text></view
        >
        <view class="image-list">
          <view v-for="(image, index) in formData.images" :key="image" class="image-item">
            <image :src="image" class="dish-image" mode="aspectFill" @tap="previewImage(index)" />
            <button
              v-if="!isExistingImage(image)"
              class="text-action image-remove"
              :aria-label="t('food.removePhotoNumber', { number: index + 1 })"
              :disabled="formLocked"
              @tap="removeImage(index)"
            >
              {{ t('food.remove') }}
            </button>
            <text v-else class="field-hint existing-image-label">{{
              t('food.existingPhoto')
            }}</text>
          </view>
          <button
            v-if="!formData.images || formData.images.length < 9"
            class="image-add"
            :disabled="formLocked"
            @tap="chooseImages"
          >
            {{ t('food.addPhotos') }}
          </button>
        </view>
      </view>

      <button
        class="optional-toggle"
        :aria-expanded="optionalExpanded"
        @tap="optionalExpanded = !optionalExpanded"
      >
        <text>{{ t('food.additionalDetailsOptional') }}</text
        ><UiIcon
          name="chevron-down"
          :class="{ 'optional-expanded': optionalExpanded }"
          :size="18"
        />
      </button>
      <template v-if="optionalExpanded">
        <view class="form-section">
          <text class="section-title">{{ t('food.nutritionPerServingOptional') }}</text>
          <view
            v-for="field in nutritionFields"
            :id="`field-${field.key}`"
            :key="field.key"
            class="form-field"
          >
            <label :for="`dish-${field.key}`" class="field-label">{{ field.label }}</label>
            <input
              :id="`dish-${field.key}`"
              v-model="formData[field.key]"
              type="digit"
              class="form-input"
              :aria-label="field.label"
              :placeholder="t('food.notProvided')"
              :disabled="formLocked"
            />
            <text v-if="fieldErrors[field.key]" class="field-error">{{
              fieldErrors[field.key]
            }}</text>
          </view>
        </view>
        <view class="form-section">
          <label for="dish-description" class="field-label">{{ t('food.dishDescription') }}</label>
          <textarea
            id="dish-description"
            v-model="formData.description"
            class="form-input description-input"
            :aria-label="t('food.dishDescription')"
            :placeholder="t('food.tastePortionSizeOrMainIngredients')"
            :disabled="formLocked"
          />
        </view>
        <view class="form-section">
          <text class="section-title">{{ t('food.dishTags') }}</text>
          <view class="choice-list badge-list">
            <button
              v-for="tag in commonTags"
              :key="tag.value"
              class="choice badge-choice"
              :class="{ 'is-selected': formData.tags?.includes(tag.value) }"
              :aria-pressed="formData.tags?.includes(tag.value)"
              :disabled="formLocked"
              @tap="toggleTag(tag.value)"
            >
              <text class="badge-label">{{ tag.label }}</text>
            </button>
          </view>
          <view class="custom-input">
            <input
              v-model="customTagInput"
              class="form-input"
              :aria-label="t('food.customTag')"
              :placeholder="t('food.addCustomTag')"
              :disabled="formLocked"
              @confirm="addCustomTag"
            />
            <button
              class="text-action"
              :disabled="formLocked || !customTagInput.trim()"
              @tap="addCustomTag"
            >
              {{ t('food.add') }}
            </button>
          </view>
          <view v-if="customTags.length" class="custom-tags">
            <view v-for="tag in customTags" :key="tag" class="custom-tag"
              ><text class="custom-tag-label">{{ tag }}</text
              ><button
                class="custom-tag-remove"
                :aria-label="t('food.removeTagNamed', { tag })"
                :disabled="formLocked"
                @tap="removeCustomTag(tag)"
              >
                <UiIcon name="close" :size="14" /></button
            ></view>
          </view>
        </view>

        <view class="form-section">
          <text class="section-title">{{ t('food.knownAllergens') }}</text>
          <text class="field-hint">{{ t('food.enterIngredientsYouKnowAboutLeaveBlankIf') }}</text>
          <view class="choice-list badge-list">
            <button
              v-for="allergen in commonAllergens"
              :key="allergen.value"
              class="choice badge-choice"
              :class="{ 'is-selected': isAllergenSelected(allergen.value) }"
              :aria-pressed="isAllergenSelected(allergen.value)"
              :disabled="formLocked"
              @tap="toggleAllergen(allergen.value)"
            >
              <text class="badge-label">{{ allergen.label }}</text>
            </button>
          </view>
          <view class="custom-input">
            <input
              v-model="customAllergenInput"
              class="form-input"
              :aria-label="t('food.customAllergen')"
              :placeholder="t('food.addCustomAllergen')"
              :disabled="formLocked"
              @confirm="addCustomAllergen"
            />
            <button
              class="text-action"
              :disabled="formLocked || !customAllergenInput.trim()"
              @tap="addCustomAllergen"
            >
              {{ t('food.add') }}
            </button>
          </view>
          <view v-if="customAllergens.length" class="custom-tags">
            <view v-for="allergen in customAllergens" :key="allergen" class="custom-tag"
              ><text class="custom-tag-label">{{ allergen }}</text
              ><button
                class="custom-tag-remove"
                :aria-label="t('food.removeAllergenNamed', { allergen })"
                :disabled="formLocked"
                @tap="removeCustomAllergen(allergen)"
              >
                <UiIcon name="close" :size="14" /></button
            ></view>
          </view>
        </view>
      </template>
      <view class="submit-bar" :style="keyboardStyle">
        <text v-if="error && !conflict" class="field-error submit-error">{{ error }}</text>
        <text v-if="draftError" class="field-error submit-error">{{ draftError }}</text>
        <button
          class="submit-button"
          :disabled="busy || leaving || !!conflict || (readOnly && !awaitingConfirmation)"
          @tap="handleSubmit"
        >
          {{
            submitted
              ? targetDishId
                ? t('food.updateSuggestedAwaitingReview2')
                : t('food.dishSuggestedAwaitingReview')
              : submitting
                ? t('food.submitting')
                : awaitingConfirmation
                  ? t('food.retryConfirmation')
                  : uploadId
                    ? targetDishId
                      ? t('food.resubmitUpdate')
                      : t('food.resubmitDish')
                    : targetDishId
                      ? t('food.submitUpdateSuggestion')
                      : t('food.suggestADish')
          }}
        </button>
        <view
          v-if="!submitted && !conflict && (dirty || draftSaved || draftRestored || savingDraft)"
          class="draft-status"
          role="status"
        >
          <text class="draft-label">{{
            savingDraft
              ? t('food.saving')
              : draftSaved
                ? t('food.draftSaved')
                : t('food.draftUnsaved')
          }}</text>
          <view class="draft-actions">
            <button v-if="!draftSaved" class="text-action" :disabled="formLocked" @tap="saveDraft">
              {{ t('food.save') }}
            </button>
            <button
              class="text-action draft-discard"
              :disabled="!canDiscardDraft || leaving"
              :aria-label="t('food.clearLocalDraft')"
              @tap="discardDraft"
            >
              {{ t('food.clear') }}
            </button>
          </view>
        </view>
      </view>
    </template>
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
import { t } from '@/i18n';
import EmptyState from '@/components/EmptyState.vue';
import { openLogin } from '@/utils/login-navigation';
import { onMounted, ref, onUnmounted, nextTick, watchEffect } from 'vue';
import { onBackPress, onHide } from '@dcloudio/uni-app';
import { nutritionFields, useAddDish } from './composables/use-add-dish';
import { useUserStore } from '@/store/modules/use-user-store';
import { useSheetKeyboard } from '@/composables/use-sheet-keyboard';
import AsyncState from '@/components/AsyncState.vue';
import UiIcon from '@/components/UiIcon.vue';

const {
  formData,
  targetDishId,
  uploadId,
  rejectionReason,
  readOnly,
  conflict,
  canDiscardDraft,
  awaitingConfirmation,
  initialize,
  initializing,
  initializationError,
  formLocked,
  savingDraft,
  draftSaved,
  draftRestored,
  draftError,
  saveDraft,
  clearDraft,
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
  isAllergenSelected,
  addCustomAllergen,
  removeCustomAllergen,
  chooseImages,
  isExistingImage,
  removeImage,
  submitForm,
} = useAddDish();
const userStore = useUserStore();
const openIdentity = () => uni.navigateTo({ url: '/pages/profile/identity' });
const keyboardStyle = useSheetKeyboard();
const leaving = ref(false);
const optionalExpanded = ref(false);
const backHelperKey = ref(0);
const renderBackHelper = ref(true);
let active = true;
let allowLeave = false;
onUnmounted(() => {
  active = false;
});
onMounted(async () => {
  const pages = getCurrentPages();
  const options = (pages[pages.length - 1] as any)?.options || {};
  await initialize({
    keyword: options.keyword ? decodeURIComponent(options.keyword) : '',
    targetDishId: options.targetDishId,
    uploadId: options.uploadId,
  });
});
watchEffect(() => {
  uni.setNavigationBarTitle({
    title: uploadId.value
      ? t('food.editDishSubmission')
      : targetDishId.value
        ? t('food.suggestAnUpdate')
        : t('food.suggestADish'),
  });
});
onHide(() => {
  if (dirty.value && !busy.value && !awaitingConfirmation.value) void saveDraft();
});
const previewImage = (index: number) =>
  uni.previewImage({ urls: formData.images || [], current: formData.images![index] });
const openMyUploads = () =>
  uni.navigateTo({
    url:
      '/pages/profile/records/my-uploads/index' +
      (uploadId.value ? '?id=' + encodeURIComponent(uploadId.value) : ''),
  });
const discardDraft = async () => {
  if (!canDiscardDraft.value || leaving.value) return;
  const session = userStore.sessionVersion;
  leaving.value = true;
  try {
    const confirmed = await new Promise<boolean>(resolve =>
      uni.showModal({
        title: conflict.value ? t('food.discardLocalChanges') : t('food.clearLocalDraft'),
        content: conflict.value
          ? t('food.discardLocalChangesAndLoadTheLatestDetails')
          : t('food.clearThisLocalDraftSubmittedInformationWillBe'),
        confirmText: conflict.value ? t('common.modal.reload') : t('common.modal.clear'),
        success: result => resolve(result.confirm),
        fail: () => resolve(false),
      })
    );
    if (confirmed && active && session === userStore.sessionVersion && clearDraft())
      await initialize();
  } finally {
    if (active && session === userStore.sessionVersion) leaving.value = false;
  }
};
const handleSubmit = async () => {
  if (await submitForm()) return;
  if (conflict.value) {
    await nextTick();
    uni.pageScrollTo({ selector: '#contribution-conflict', duration: 200 });
    return;
  }
  const field = Object.keys(fieldErrors.value)[0];
  if (field) {
    if (nutritionFields.some(item => item.key === field)) optionalExpanded.value = true;
    await nextTick();
    uni.pageScrollTo({ selector: '#field-' + field, duration: 200 });
  }
};
const requestLeave = async () => {
  if (submitting.value || leaving.value) return false;
  const session = userStore.sessionVersion;
  leaving.value = true;
  try {
    if (dirty.value && !draftSaved.value && !awaitingConfirmation.value) {
      const confirmed = await new Promise<boolean>(resolve =>
        uni.showModal({
          title: t('food.keepDraft'),
          content: t('food.saveOnThisDeviceAndReturnYouCan'),
          confirmText: t('common.modal.save'),
          cancelText: t('common.modal.edit'),
          success: result => resolve(result.confirm),
          fail: () => resolve(false),
        })
      );
      if (!confirmed || !active || session !== userStore.sessionVersion) return false;
      if (!(await saveDraft())) return false;
    }
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
.add-dish-page--state {
  padding-bottom: 0;
}
.draft-status,
.optional-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.draft-status {
  min-height: 36px;
}
.draft-label,
.image-count {
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
.draft-actions {
  display: flex;
  gap: 12px;
}
.draft-actions .text-action {
  min-height: 44px;
  padding-top: 4px;
  padding-bottom: 4px;
}
.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.section-heading .section-title {
  margin-bottom: 0;
}
.conflict-state {
  padding-top: 16px;
}
.draft-discard {
  padding-left: 0;
  color: #667085;
}
.optional-toggle {
  width: 100%;
  min-height: 52px;
  padding: 14px 0;
  margin: 0;
  background: #fff;
  color: #475467;
  font-size: 16px;
  text-align: left;
}
.optional-toggle:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.optional-expanded {
  transform: rotate(180deg);
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
.required-marker {
  margin-left: 4px;
  color: #b42318;
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
  height: 96px;
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
  min-width: 44px;
  padding: 6px 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 13px;
}
.badge-choice[disabled],
.custom-tag-remove[disabled] {
  background: transparent;
}
.badge-list {
  row-gap: 0;
}
.badge-label {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 32px;
  padding: 4px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f4f4f5;
}
.badge-choice.is-selected .badge-label {
  border-color: #660874;
}
.choice.is-selected {
  border-color: #660874;
  color: #660874;
}
.choice:focus-visible,
.text-action:focus-visible,
.custom-tag-remove:focus-visible,
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
.existing-image-label {
  text-align: center;
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
  gap: 0 8px;
  margin-top: 8px;
}
.custom-tag {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  min-height: 44px;
  max-width: 100%;
  padding-left: 12px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.custom-tag::before {
  content: '';
  position: absolute;
  inset: 6px 0;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f4f4f5;
  pointer-events: none;
}
.custom-tag-label {
  position: relative;
  min-width: 0;
  padding: 6px 0;
  color: #475467;
  line-height: 20px;
}
.custom-tag-remove {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
}
.custom-tag-remove:active {
  opacity: 0.72;
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
