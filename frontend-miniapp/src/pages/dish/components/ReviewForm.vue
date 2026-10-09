<template>
  <view class="review-overlay" :style="keyboardStyle" @tap="handleClose">
    <view v-if="showResumeDialog" class="resume-dialog" @tap.stop>
      <text class="sheet-title">继续未完成的评价？</text>
      <text class="sheet-hint">本地草稿包含上次填写的内容。</text>
      <view class="sheet-actions">
        <button class="sheet-button" @tap="startNewReview">重新填写</button>
        <button class="sheet-button sheet-primary" :disabled="isResuming" @tap="resumeReview">
          继续填写
        </button>
      </view>
    </view>
    <view
      v-else
      class="review-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="isEditing ? '修改评价' : '写评价'"
      @tap.stop
    >
      <view class="sheet-header">
        <text class="sheet-title">{{ isEditing ? '修改评价' : '写评价' }}</text>
        <button
          class="sheet-button sheet-close"
          aria-label="关闭评价"
          :disabled="busy || closing"
          @tap="handleClose"
        >
          关闭
        </button>
      </view>
      <scroll-view class="sheet-body" scroll-y :scroll-into-view="scrollIntoView">
        <view class="sheet-content">
          <view class="sheet-field overall-rating">
            <text class="sheet-label">总体评价</text>
            <text class="sheet-hint">{{ ratingText }}</text>
            <view class="rating-options">
              <button
                v-for="star in 5"
                :key="star"
                class="sheet-button rating-option"
                :class="{ selected: star <= rating }"
                :aria-label="'总体评分 ' + star + ' 星'"
                :aria-pressed="star === rating"
                :disabled="busy"
                @tap="setRating(star)"
              >
                <text aria-hidden="true">{{ star <= rating ? '★' : '☆' }}</text>
              </button>
            </view>
          </view>
          <view v-if="rating > 0" class="sheet-field">
            <view class="flavor-heading">
              <text class="sheet-label">口味强度（选填）</text>
              <button
                class="sheet-button"
                :disabled="busy || !hasFlavorSelection"
                @tap="resetFlavorRatings"
              >
                清除
              </button>
            </view>
            <text class="sheet-hint">四项全部填写或全部留空；数值越高，口味越强。</text>
            <view v-for="option in flavorOptions" :key="option.key" class="flavor-row">
              <view class="flavor-label"
                ><text>{{ option.label }}</text
                ><text class="sheet-hint">{{
                  flavorRatings[option.key] ? '强度 ' + flavorRatings[option.key] : '未设置'
                }}</text></view
              >
              <view class="flavor-options">
                <button
                  v-for="level in 5"
                  :key="level"
                  class="sheet-button flavor-option"
                  :class="{ selected: level === flavorRatings[option.key] }"
                  :aria-label="option.label + '强度 ' + level + '，共 5 级'"
                  :aria-pressed="level === flavorRatings[option.key]"
                  :disabled="busy"
                  @tap="setFlavorRating(option.key, level)"
                >
                  {{ level }}
                </button>
              </view>
            </view>
            <text v-if="showFlavorError && !flavorSelectionComplete" class="sheet-error"
              >请将四项口味全部填写，或清除全部选择。</text
            >
          </view>
          <view id="review-content-field" class="sheet-field">
            <label for="review-content" class="sheet-label">用餐体验（选填）</label>
            <textarea
              id="review-content"
              v-model="content"
              class="sheet-input review-content-input"
              aria-label="用餐体验"
              placeholder="口味、分量或值得分享的细节"
              maxlength="500"
              :disabled="busy"
              :adjust-position="false"
              @focus="focusField('review-content-field')"
              @blur="blurField"
            />
            <text class="sheet-hint character-count">{{ content.length }}/500</text>
          </view>
          <view class="sheet-field">
            <text class="sheet-label">评价图片（选填）</text>
            <text class="sheet-hint">最多 3 张，提交评价时上传。</text>
            <view class="review-images">
              <view v-for="(img, index) in images" :key="img.path" class="review-image-item">
                <image
                  :src="img.path"
                  class="review-image"
                  mode="aspectFill"
                  @tap="handlePreviewImage(index)"
                />
                <button
                  class="sheet-button image-remove"
                  :aria-label="'移除第 ' + (index + 1) + ' 张图片'"
                  :disabled="busy"
                  @tap.stop="removeImage(index)"
                >
                  移除
                </button>
              </view>
              <button
                v-if="images.length < 3"
                class="sheet-button image-add"
                :disabled="busy"
                @tap="handleChooseImage"
              >
                添加图片
              </button>
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="sheet-footer">
        <button
          v-if="draftSaveFailed"
          class="sheet-button draft-discard"
          :disabled="busy || closing"
          @tap="discardDraft"
        >
          放弃草稿并关闭
        </button>
        <button
          class="sheet-button sheet-primary"
          :disabled="busy || closing || (isEditing && !dirty)"
          @tap="handleSubmit"
        >
          {{
            isSaving ? '保存草稿中…' : submitting ? '提交中…' : isEditing ? '更新评价' : '提交评价'
          }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
import { useReviewForm } from '../composables/use-review';
import { useSheetKeyboard, useSheetInputScroll } from '../composables/use-sheet-keyboard';
import { useUserStore } from '@/store/modules/use-user-store';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import type { Review } from '@/types/api';

const props = defineProps<{
  dishId: string;
  dishName: string;
  existingReviewId?: string;
  initialReview?: Review | null;
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'success', review: Review): void }>();
const userStore = useUserStore();
const isEditing = computed(() => !!props.existingReviewId);
const { scrollIntoView, focusField, blurField, revealFocusedField } = useSheetInputScroll();
const keyboardStyle = useSheetKeyboard(revealFocusedField);
const {
  rating,
  content,
  images,
  isSaving,
  busy,
  submitting,
  showFlavorError,
  flavorOptions,
  flavorRatings,
  hasFlavorSelection,
  flavorSelectionComplete,
  ratingText,
  setRating,
  setFlavorRating,
  resetFlavorRatings,
  resetForm,
  saveReviewState,
  loadReviewState,
  clearReviewState,
  hasSavedReviewState,
  handleSubmit: submitForm,
  addImages,
  setRemoteImages,
  removeImage,
} = useReviewForm();
const snapshot = () =>
  JSON.stringify({
    rating: rating.value,
    content: content.value,
    images: images.value,
    flavorRatings: flavorRatings.value,
  });
const baseline = ref(snapshot());
const dirty = computed(() => snapshot() !== baseline.value);
const closing = ref(false);
const draftSaveFailed = ref(false);
const showResumeDialog = ref(false);
const isResuming = ref(false);
let active = true;
let initializedReviewId = '';

watch(
  () => props.initialReview,
  review => {
    if (!isEditing.value || !review || initializedReviewId === review.id) return;
    initializedReviewId = review.id;
    resetForm();
    rating.value = review.rating || 0;
    content.value = review.content || '';
    setRemoteImages(review.images || []);
    if (review.ratingDetails)
      flavorRatings.value = {
        spicyLevel: review.ratingDetails.spicyLevel ?? 0,
        sweetness: review.ratingDetails.sweetness ?? 0,
        saltiness: review.ratingDetails.saltiness ?? 0,
        oiliness: review.ratingDetails.oiliness ?? 0,
      };
    baseline.value = snapshot();
  },
  { immediate: true }
);

onMounted(() => {
  if (!isEditing.value) showResumeDialog.value = hasSavedReviewState(props.dishId);
});
onUnmounted(() => {
  active = false;
});
const handleChooseImage = () => {
  if (!active || busy.value || images.value.length >= 3) return;
  const session = userStore.sessionVersion;
  const owner = userStore.userInfo?.id;
  uni.chooseImage({
    count: 3 - images.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: result => {
      if (active && session === userStore.sessionVersion && owner === userStore.userInfo?.id)
        addImages(result.tempFilePaths as string[]);
    },
  });
};
const handlePreviewImage = (index: number) =>
  uni.previewImage({
    urls: images.value.map(image => image.path),
    current: images.value[index].path,
  });
const handleClose = async () => {
  if (!active || busy.value || closing.value) return false;
  const session = userStore.sessionVersion;
  const owner = userStore.userInfo?.id;
  closing.value = true;
  try {
    if (isEditing.value) {
      if (!(await confirmDiscardChanges(dirty.value, '评价的修改尚未提交，确定放弃吗？')))
        return false;
    } else if (!showResumeDialog.value) {
      if (rating.value || content.value.trim() || hasFlavorSelection.value || images.value.length) {
        if (!(await saveReviewState(props.dishId))) {
          if (active && session === userStore.sessionVersion && owner === userStore.userInfo?.id)
            draftSaveFailed.value = true;
          return false;
        }
      } else clearReviewState(props.dishId);
    }
    if (!active || session !== userStore.sessionVersion || owner !== userStore.userInfo?.id)
      return false;
    emit('close');
    return true;
  } finally {
    closing.value = false;
  }
};
const discardDraft = async () => {
  if (!active || busy.value || closing.value) return false;
  const session = userStore.sessionVersion;
  const owner = userStore.userInfo?.id;
  closing.value = true;
  try {
    if (!(await confirmDiscardChanges(true, '将放弃这次评价中的文字和图片，确定关闭吗？')))
      return false;
    if (!active || session !== userStore.sessionVersion || owner !== userStore.userInfo?.id)
      return false;
    clearReviewState(props.dishId);
    emit('close');
    return true;
  } finally {
    closing.value = false;
  }
};
const handleSubmit = () => {
  if (closing.value || (isEditing.value && (!props.initialReview || !dirty.value))) return;
  return submitForm(props.dishId, review => emit('success', review), props.existingReviewId);
};
const resumeReview = () => {
  isResuming.value = true;
  if (loadReviewState(props.dishId)) showResumeDialog.value = false;
  isResuming.value = false;
};
const startNewReview = () => {
  resetForm();
  clearReviewState(props.dishId);
  showResumeDialog.value = false;
};
defineExpose({ requestClose: handleClose });
</script>

<style scoped>
@import './review-sheet.css';
.resume-dialog {
  align-self: center;
  width: calc(100% - 40px);
  max-width: 360px;
  padding: 24px;
  box-sizing: border-box;
  border-radius: 16px;
  background: #fff;
}
.resume-dialog > .sheet-title {
  display: block;
  margin-bottom: 12px;
}
.resume-dialog .sheet-actions {
  margin-top: 24px;
}
.overall-rating {
  text-align: center;
}
.rating-options {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  gap: 4px;
}
.rating-option {
  width: 48px;
  height: 48px;
  padding: 0;
  color: #98a2b3;
  font-size: 32px;
}
.rating-option.selected {
  color: #d99a12;
}
.flavor-heading,
.flavor-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.flavor-row {
  margin-top: 16px;
}
.flavor-label {
  font-size: 14px;
}
.flavor-options {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.flavor-option {
  flex: 1;
  border: 1px solid #d0d5dd;
}
.flavor-option.selected {
  background: #660874;
  border-color: #660874;
  color: #fff;
}
.review-content-input {
  height: 120px;
  margin-top: 12px;
}
.character-count {
  text-align: right;
  margin-top: 4px;
}
.review-images {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-top: 12px;
}
.review-image-item {
  width: 76px;
}
.review-image {
  display: block;
  width: 76px;
  height: 76px;
  border-radius: 10px;
}
.image-remove {
  width: 76px;
  padding: 8px 0;
}
.image-add {
  width: 76px;
  height: 76px;
  padding: 6px;
  border: 1px dashed #98a2b3;
}
.draft-discard {
  width: 100%;
  margin-bottom: 8px;
}
</style>
