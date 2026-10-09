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
      aria-label="举报内容"
      @tap.stop
    >
      <view class="sheet-header">
        <text class="sheet-title">举报内容</text>
        <button
          class="sheet-button sheet-close"
          :disabled="submitting || closing"
          aria-label="关闭举报"
          @tap="close"
        >
          关闭
        </button>
      </view>
      <scroll-view class="sheet-body" scroll-y :scroll-into-view="scrollIntoView">
        <view class="sheet-content">
          <view class="sheet-field">
            <text class="sheet-label">举报类型</text>
            <picker
              :range="reportTypes"
              range-key="label"
              :disabled="submitting"
              @change="handleTypeChange"
            >
              <view class="sheet-input report-picker">{{
                selectedTypeLabel || '请选择举报类型'
              }}</view>
            </picker>
          </view>
          <view id="report-reason-field" class="sheet-field">
            <label for="report-reason" class="sheet-label">详细理由</label>
            <textarea
              id="report-reason"
              v-model="reason"
              class="sheet-input report-reason"
              aria-label="举报详细理由"
              placeholder="请说明内容存在的问题"
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
        <button class="sheet-button" :disabled="submitting || closing" @tap="close">取消</button>
        <button class="sheet-button sheet-primary" :disabled="submitting || closing" @tap="submit">
          {{ submitting ? '提交中…' : '提交举报' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import { useSheetKeyboard, useSheetInputScroll } from '../composables/use-sheet-keyboard';

const props = withDefaults(defineProps<{ submitting?: boolean }>(), { submitting: false });
const emit = defineEmits(['close', 'submit']);
const userStore = useUserStore();
const { scrollIntoView, focusField, blurField, revealFocusedField } = useSheetInputScroll();
const keyboardStyle = useSheetKeyboard(revealFocusedField);
const reportTypes = [
  { value: 'inappropriate', label: '内容不当' },
  { value: 'spam', label: '垃圾广告' },
  { value: 'false_info', label: '虚假信息' },
  { value: 'other', label: '其他' },
];
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
const selectedTypeLabel = computed(() => reportTypes[selectedTypeIndex.value]?.label || '');
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
      '举报内容尚未提交，确定放弃吗？'
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
    uni.showToast({ title: '请选择举报类型', icon: 'none' });
    return;
  }
  if (!reason.value.trim()) {
    uni.showToast({ title: '请填写详细理由', icon: 'none' });
    return;
  }
  emit('submit', { type: reportTypes[selectedTypeIndex.value].value, reason: reason.value.trim() });
};
defineExpose({ requestClose: close });
</script>

<style scoped>
@import './review-sheet.css';
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
