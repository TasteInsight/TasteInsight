<template>
  <view
    class="add-dish-page page-content page-state-layout"
    :class="{ 'add-dish-page--state': !userStore.isLoggedIn }"
  >
    <EmptyState
      v-if="!userStore.isLoggedIn"
      class="page-state-region"
      title="登录后申请新增菜品"
      icon="edit"
      action-text="登录"
      @action="openLogin"
    />
    <EmptyState
      v-else-if="!userStore.userInfo?.capabilities?.canContribute"
      class="page-state-region"
      title="认证后可提交菜品申请"
      description="完成校园身份认证后，即可申请新增或补充菜品资料。"
      icon="shield"
      action-text="去认证"
      @action="openIdentity"
    />
    <view v-else-if="initializationError" class="error-feedback page-state-region" role="alert">
      <text class="error-feedback__message">{{ initializationError }}</text>
      <button
        class="error-feedback__action"
        hover-class="error-feedback__action--pressed"
        @tap="initialize()"
      >
        重新加载
      </button>
    </view>
    <AddDishSkeleton v-else-if="initializing" />
    <template v-else>
      <view v-if="submitted" class="submission-success" role="status">
        <text class="success-title">{{ targetDishId ? '建议已提交' : '申请已提交' }}</text>
        <text>{{ targetDishId ? '补充建议' : '新增菜品申请' }}已送交审核，即将前往我的上传。</text>
      </view>
      <text v-if="rejectionReason" class="field-error">未通过原因：{{ rejectionReason }}</text>
      <text v-if="readOnly" class="field-error">当前记录不可编辑，请到我的上传查看状态。</text>
      <view v-if="conflict" id="contribution-conflict" role="alert" class="conflict-state">
        <text class="field-error">{{
          conflict === 'target'
            ? '菜品资料已更新。草稿仍保留，可放弃本次修改并加载最新资料。'
            : conflict === 'upload'
              ? '上传记录或目标菜品资料已更新。可放弃本机修改，重新加载资料。'
              : '上传记录已存在，请先查看我的上传。'
        }}</text>
        <button
          v-if="canDiscardDraft"
          class="text-action draft-discard"
          :disabled="leaving"
          @tap="discardDraft"
        >
          放弃草稿并加载最新资料
        </button>
      </view>
      <button
        v-if="readOnly || conflict === 'upload' || conflict === 'request'"
        class="text-action"
        @tap="openMyUploads"
      >
        查看我的上传
      </button>
      <text v-if="awaitingConfirmation" class="field-hint" role="status"
        >提交结果待确认。重试不会重复创建记录。</text
      >
      <view class="form-section">
        <view id="field-name" class="form-field">
          <label for="dish-name" class="field-label"
            >菜品名称<text class="required-marker" aria-hidden="true">*</text></label
          >
          <input
            id="dish-name"
            v-model="formData.name"
            class="form-input"
            aria-label="菜品名称"
            aria-required="true"
            placeholder="例如：番茄炒蛋"
            :disabled="formLocked"
          />
          <text v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</text>
        </view>
        <view id="field-price" class="form-field">
          <label for="dish-price" class="field-label"
            >价格<text class="required-marker" aria-hidden="true">*</text></label
          >
          <view class="price-fields">
            <view class="price-value"
              ><text>¥</text
              ><input
                id="dish-price"
                v-model.number="formData.price"
                class="form-input"
                type="digit"
                aria-label="菜品价格"
                aria-required="true"
                placeholder="0.00"
                :disabled="formLocked"
            /></view>
            <text class="price-divider">/</text
            ><input
              v-model="formData.priceUnit"
              class="form-input price-unit"
              aria-label="价格单位"
              placeholder="份"
              :disabled="formLocked"
            />
          </view>
          <text v-if="fieldErrors.price" class="field-error">{{ fieldErrors.price }}</text>
        </view>
      </view>

      <view class="form-section">
        <text class="section-title">位置与供应</text>
        <view id="field-canteen" class="form-field">
          <text class="field-label" aria-label="所在食堂，必填"
            >所在食堂<text class="required-marker" aria-hidden="true">*</text></text
          >
          <text v-if="targetDishId" class="field-hint"
            >{{ formData.canteenName }}（补充资料时不可更换食堂）</text
          >
          <text v-else-if="loading" class="field-hint">正在加载食堂…</text>
          <view v-else-if="canteenError" class="error-feedback" role="alert">
            <text class="error-feedback__message">{{ canteenError }}</text
            ><button
              class="error-feedback__action"
              hover-class="error-feedback__action--pressed"
              @tap="loadCanteenList"
            >
              重新加载
            </button>
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
              :disabled="formLocked"
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
              :disabled="formLocked"
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
              :disabled="formLocked"
              @tap="selectWindow(window)"
            >
              <text>{{ window.name }}</text
              ><text v-if="window.floor" class="window-floor">{{
                window.floor.name || window.floor.level + '楼'
              }}</text>
            </button>
          </view>
          <text v-else class="field-hint">该食堂暂无窗口信息，可按食堂提交申请。</text>
        </view>
        <view id="field-availableMealTime" class="form-field">
          <text class="field-label" aria-label="供应时段，必填"
            >供应时段<text class="required-marker" aria-hidden="true">*</text></text
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
          ><text class="section-title">{{ targetDishId ? '补充照片' : '菜品照片' }}</text
          ><text class="image-count">{{ formData.images?.length || 0 }}/9</text></view
        >
        <view class="image-list">
          <view v-for="(image, index) in formData.images" :key="image" class="image-item">
            <image :src="image" class="dish-image" mode="aspectFill" @tap="previewImage(index)" />
            <button
              v-if="!isExistingImage(image)"
              class="text-action image-remove"
              :aria-label="'移除第 ' + (index + 1) + ' 张图片'"
              :disabled="formLocked"
              @tap="removeImage(index)"
            >
              移除
            </button>
            <text v-else class="field-hint existing-image-label">已有图片</text>
          </view>
          <button
            v-if="!formData.images || formData.images.length < 9"
            class="image-add"
            :disabled="formLocked"
            @tap="chooseImages"
          >
            添加图片
          </button>
        </view>
      </view>

      <button
        class="optional-toggle"
        :aria-expanded="optionalExpanded"
        @tap="optionalExpanded = !optionalExpanded"
      >
        <text>补充信息（选填）</text
        ><UiIcon
          name="chevron-down"
          :class="{ 'optional-expanded': optionalExpanded }"
          :size="18"
        />
      </button>
      <template v-if="optionalExpanded">
        <view class="form-section">
          <text class="section-title">每份营养信息（选填）</text>
          <view v-for="field in nutritionFields" :id="`field-${field.key}`" :key="field.key" class="form-field">
            <label :for="`dish-${field.key}`" class="field-label">{{ field.label }}</label>
            <input :id="`dish-${field.key}`" v-model="formData[field.key]" type="digit" class="form-input" :aria-label="field.label" placeholder="未提供" :disabled="formLocked" />
            <text v-if="fieldErrors[field.key]" class="field-error">{{ fieldErrors[field.key] }}</text>
          </view>
        </view>
        <view class="form-section">
          <label for="dish-description" class="field-label">菜品介绍</label>
          <textarea
            id="dish-description"
            v-model="formData.description"
            class="form-input description-input"
            aria-label="菜品介绍"
            placeholder="口味、分量或主要食材"
            :disabled="formLocked"
          />
        </view>
        <view class="form-section">
          <text class="section-title">菜品标签</text>
          <view class="choice-list badge-list">
            <button
              v-for="tag in commonTags"
              :key="tag"
              class="choice badge-choice"
              :class="{ 'is-selected': formData.tags?.includes(tag) }"
              :aria-pressed="formData.tags?.includes(tag)"
              :disabled="formLocked"
              @tap="toggleTag(tag)"
            >
              <text class="badge-label">{{ tag }}</text>
            </button>
          </view>
          <view class="custom-input">
            <input
              v-model="customTagInput"
              class="form-input"
              aria-label="自定义标签"
              placeholder="添加自定义标签"
              :disabled="formLocked"
              @confirm="addCustomTag"
            />
            <button
              class="text-action"
              :disabled="formLocked || !customTagInput.trim()"
              @tap="addCustomTag"
            >
              添加
            </button>
          </view>
          <view v-if="customTags.length" class="custom-tags">
            <view v-for="tag in customTags" :key="tag" class="custom-tag"
              ><text class="custom-tag-label">{{ tag }}</text
              ><button
                class="custom-tag-remove"
                :aria-label="'移除标签 ' + tag"
                :disabled="formLocked"
                @tap="removeCustomTag(tag)"
              >
                <UiIcon name="close" :size="14" /></button
            ></view>
          </view>
        </view>

        <view class="form-section">
          <text class="section-title">已知过敏原</text>
          <text class="field-hint">仅填写已了解的原料信息；不确定时可留空。</text>
          <view class="choice-list badge-list">
            <button
              v-for="allergen in commonAllergens"
              :key="allergen"
              class="choice badge-choice"
              :class="{ 'is-selected': formData.allergens?.includes(allergen) }"
              :aria-pressed="formData.allergens?.includes(allergen)"
              :disabled="formLocked"
              @tap="toggleAllergen(allergen)"
            >
              <text class="badge-label">{{ allergen }}</text>
            </button>
          </view>
          <view class="custom-input">
            <input
              v-model="customAllergenInput"
              class="form-input"
              aria-label="自定义过敏原"
              placeholder="添加自定义过敏原"
              :disabled="formLocked"
              @confirm="addCustomAllergen"
            />
            <button
              class="text-action"
              :disabled="formLocked || !customAllergenInput.trim()"
              @tap="addCustomAllergen"
            >
              添加
            </button>
          </view>
          <view v-if="customAllergens.length" class="custom-tags">
            <view v-for="allergen in customAllergens" :key="allergen" class="custom-tag"
              ><text class="custom-tag-label">{{ allergen }}</text
              ><button
                class="custom-tag-remove"
                :aria-label="'移除过敏原 ' + allergen"
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
                ? '建议已提交，等待审核'
                : '申请已提交，等待审核'
              : submitting
                ? '提交中…'
                : awaitingConfirmation
                  ? '重试确认结果'
                  : uploadId
                    ? targetDishId
                      ? '重新提交建议'
                      : '重新提交申请'
                    : targetDishId
                      ? '提交补充建议'
                      : '申请新增菜品'
          }}
        </button>
        <view
          v-if="!submitted && !conflict && (dirty || draftSaved || draftRestored || savingDraft)"
          class="draft-status"
          role="status"
        >
          <text class="draft-label">{{
            savingDraft ? '保存中…' : draftSaved ? '草稿已保存' : '草稿未保存'
          }}</text>
          <view class="draft-actions">
            <button v-if="!draftSaved" class="text-action" :disabled="formLocked" @tap="saveDraft">
              保存
            </button>
            <button
              class="text-action draft-discard"
              :disabled="!canDiscardDraft || leaving"
              aria-label="清除本机草稿"
              @tap="discardDraft"
            >
              清除
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
import EmptyState from '@/components/EmptyState.vue';
import { openLogin } from '@/utils/login-navigation';
import { onMounted, ref, onUnmounted, nextTick } from 'vue';
import { onBackPress, onHide } from '@dcloudio/uni-app';
import { nutritionFields, useAddDish } from './composables/use-add-dish';
import { useUserStore } from '@/store/modules/use-user-store';
import { useSheetKeyboard } from '@/pages/dish/composables/use-sheet-keyboard';
import AddDishSkeleton from '@/components/skeleton/AddDishSkeleton.vue';
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
  if (active)
    uni.setNavigationBarTitle({
      title: uploadId.value ? '修改申请资料' : targetDishId.value ? '申请补充资料' : '申请新增菜品',
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
      '/pages/profile/my-uploads/index' +
      (uploadId.value ? '?id=' + encodeURIComponent(uploadId.value) : ''),
  });
const discardDraft = async () => {
  if (!canDiscardDraft.value || leaving.value) return;
  const session = userStore.sessionVersion;
  leaving.value = true;
  try {
    const confirmed = await new Promise<boolean>(resolve =>
      uni.showModal({
        title: conflict.value ? '放弃本机修改' : '清除本机草稿',
        content: conflict.value
          ? '当前修改将被清除，并加载最新资料。已提交的资料不受影响。'
          : '只清除此条草稿，已提交的资料不受影响。',
        confirmText: conflict.value ? '放弃并加载' : '清除',
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
          title: '保留草稿',
          content: '保存到本机后返回，下次可继续编辑。',
          confirmText: '保存并返回',
          cancelText: '继续编辑',
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
