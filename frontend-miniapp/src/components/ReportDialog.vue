<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-container
    :key="helperKey"
    :show="true"
    :overlay="false"
    :duration="0"
    custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
    @leave="close"
    @afterleave="restoreHelper"
  />
  <!-- #endif -->
  <view class="review-overlay report-overlay" :style="keyboardStyle" @tap.stop="close">
    <view
      class="review-sheet report-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="t('food.reportContent')"
      @tap.stop
    >
      <view class="sheet-header">
        <text class="sheet-title">{{ t('food.reportContent') }}</text>
        <button
          class="sheet-button sheet-close"
          :class="{ 'is-disabled': submitting || closing }"
          :disabled="submitting || closing"
          :aria-label="t('food.closeReport')"
          @tap="close"
        >
          {{ t('food.close') }}
        </button>
      </view>
      <scroll-view class="sheet-body" scroll-y :scroll-into-view="scrollIntoView">
        <view class="sheet-content">
          <view class="sheet-field">
            <text class="sheet-label">{{ t('food.reportType') }}</text>
            <UiPicker
              :range="reportTypes"
              :value="Math.max(0, selectedTypeIndex)"
              range-key="label"
              :disabled="submitting"
              @change="handleTypeChange"
            >
              <view class="sheet-input report-picker">{{
                selectedTypeLabel || t('food.selectAReportType')
              }}</view>
            </UiPicker>
          </view>
          <view id="report-reason-field" class="sheet-field">
            <label for="report-reason" class="sheet-label">{{ t('food.details') }}</label>
            <textarea
              id="report-reason"
              v-model="reason"
              class="sheet-input report-reason"
              :aria-label="t('food.reportDetails')"
              :placeholder="t('food.describeTheIssueWithThisContent')"
              maxlength="500"
              :disabled="submitting"
              :adjust-position="false"
              @focus="focusField('report-reason-field')"
              @blur="blurField"
            />
          </view>
        </view>
      </scroll-view>
      <view class="sheet-footer sheet-actions">
        <button
          class="sheet-button"
          :class="{ 'is-disabled': submitting || closing }"
          :disabled="submitting || closing"
          @tap="close"
        >
          {{ t('food.cancel') }}
        </button>
        <button
          class="sheet-button sheet-primary"
          :class="{ 'is-disabled': submitting || closing }"
          :disabled="submitting || closing"
          @tap="submit"
        >
          {{ submitting ? t('food.submitting') : t('food.submitReport') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { ref, computed, onUnmounted } from 'vue';
import UiPicker from '@/components/UiPicker.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import { useSheetKeyboard, useSheetInputScroll } from '@/composables/use-sheet-keyboard';

const props = withDefaults(defineProps<{ submitting?: boolean }>(), { submitting: false });
const emit = defineEmits(['close', 'submit']);
const userStore = useUserStore();
const { scrollIntoView, focusField, blurField, revealFocusedField } = useSheetInputScroll();
const keyboardStyle = useSheetKeyboard(revealFocusedField);
const reportTypes = computed(() => [
  {
    value: 'inappropriate',
    get label() {
      return t('food.inappropriateContent');
    },
  },
  {
    value: 'spam',
    get label() {
      return t('food.spam');
    },
  },
  {
    value: 'false_info',
    get label() {
      return t('food.falseInformation');
    },
  },
  {
    value: 'other',
    get label() {
      return t('food.other');
    },
  },
]);
const selectedTypeIndex = ref(-1);
const reason = ref('');
const closing = ref(false);
const helperKey = ref(0);
let active = true;
onUnmounted(() => {
  active = false;
});
const restoreHelper = () => {
  if (active) helperKey.value++;
};
const selectedTypeLabel = computed(() => reportTypes.value[selectedTypeIndex.value]?.label || '');
const handleTypeChange = (event: any) => {
  if (!props.submitting) selectedTypeIndex.value = Number(event.detail.value);
};
const close = async () => {
  if (props.submitting || closing.value) return false;
  closing.value = true;
  const session = userStore.sessionVersion;
  try {
    const discard = await confirmDiscardChanges(
      selectedTypeIndex.value !== -1 || !!reason.value.trim(),
      t('food.discardThisReport')
    );
    if (!discard || !active || session !== userStore.sessionVersion) return false;
    emit('close');
    return true;
  } finally {
    closing.value = false;
  }
};
const submit = () => {
  if (props.submitting || closing.value) return;
  if (selectedTypeIndex.value === -1) {
    uni.showToast({ title: t('food.selectAReportType'), icon: 'none' });
    return;
  }
  if (!reason.value.trim()) {
    uni.showToast({ title: t('food.enterADetailedReason'), icon: 'none' });
    return;
  }
  emit('submit', {
    type: reportTypes.value[selectedTypeIndex.value].value,
    reason: reason.value.trim(),
  });
};
defineExpose({ requestClose: close });
</script>

<style scoped>
@import '@/styles/review-sheet.css';
.report-overlay {
  z-index: 5000;
}
.report-sheet {
  height: min(520px, 92%);
}
.report-picker {
  margin-top: 12px;
  min-height: 48px;
}
.report-reason {
  margin-top: 12px;
  height: 140px;
}
</style>
