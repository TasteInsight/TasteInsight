<template>
  <view class="preference-card" :aria-busy="draft.status === 'saving'">
    <text class="preference-title">长期偏好变更</text>
    <text v-if="draft.summary && !finished" class="preference-summary">{{ draft.summary }}</text>

    <view v-if="rows.length" class="preference-preview">
      <view class="preference-columns preference-column-headings" aria-hidden="true">
        <text class="preference-value">调整前</text><text class="preference-value">调整后</text>
      </view>
      <view v-for="row in rows" :key="row.key" class="preference-row">
        <text class="preference-field">{{ row.label }}</text>
        <view class="preference-columns">
          <text class="preference-value" :aria-label="`${row.label}，调整前：${row.before}`">{{
            row.before
          }}</text>
          <text class="preference-value" :aria-label="`${row.label}，调整后：${row.after}`">{{
            row.after
          }}</text>
        </view>
      </view>
    </view>
    <text v-else class="preference-message" role="status">建议缺少变更内容，请重新生成。</text>

    <text
      v-if="statusText"
      class="preference-message"
      :class="{ 'preference-error': draft.error }"
      role="status"
      aria-live="polite"
      >{{ statusText }}</text
    >
    <view class="preference-actions">
      <button
        class="preference-action preference-save"
        hover-class="preference-control-pressed"
        :hover-stay-time="80"
        role="button"
        :tabindex="saveDisabled ? -1 : 0"
        :disabled="saveDisabled"
        :aria-disabled="saveDisabled"
        @click="handleAction('save')"
        @keydown="handleKeydown($event, 'save')"
        @keyup="handleKeyup($event, 'save')"
        @blur="pressedAction = null"
      >
        {{ saveText }}
      </button>
      <button
        class="preference-action preference-dismiss"
        hover-class="preference-control-pressed"
        :hover-stay-time="80"
        role="button"
        :tabindex="dismissDisabled ? -1 : 0"
        :disabled="dismissDisabled"
        :aria-disabled="dismissDisabled"
        @click="handleAction('dismiss')"
        @keydown="handleKeydown($event, 'dismiss')"
        @keyup="handleKeyup($event, 'dismiss')"
        @blur="pressedAction = null"
      >
        暂不保存
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PreferenceDraftCard } from '@/store/modules/use-chat-store';

const props = defineProps<{ draft: PreferenceDraftCard }>();
const emit = defineEmits<{
  (event: 'save', draft: PreferenceDraftCard): void;
  (event: 'dismiss', draft: PreferenceDraftCard): void;
}>();
type Action = 'save' | 'dismiss';
const pressedAction = ref<Action | null>(null);
const finished = computed(() =>
  ['saving', 'saved', 'dismissed'].includes(props.draft.status || '')
);
const dismissDisabled = computed(() => finished.value);
const saveDisabled = computed(
  () =>
    finished.value || !rows.value.length || ['stale', 'invalid'].includes(props.draft.status || '')
);
const saveText = computed(() => {
  if (props.draft.status === 'saved') return '已保存';
  if (props.draft.status === 'saving') return '保存中…';
  if (props.draft.status === 'failed') return '重试保存';
  return '保存偏好';
});
const statusText = computed(() => {
  if (props.draft.error) return props.draft.error;
  if (props.draft.status === 'saved') return '偏好已保存。';
  if (props.draft.status === 'dismissed') return '本条建议暂不保存。';
  if (props.draft.status === 'saving') return '正在核对最新偏好并保存…';
  return '';
});

const listText = (value: unknown) =>
  Array.isArray(value) && value.every(item => typeof item === 'string')
    ? value.length
      ? value.join('、')
      : '无'
    : '信息缺失';
const priceText = (value: any) =>
  typeof value?.min === 'number' && typeof value?.max === 'number'
    ? `¥${value.min} — ¥${value.max}`
    : '信息缺失';
const tasteFields = {
  spicyLevel: '辣度',
  sweetness: '甜度',
  saltiness: '咸度',
  oiliness: '油腻度',
};
const tasteText = (value: unknown, key: string) => {
  const labels =
    key === 'spicyLevel'
      ? ['未设置', '微辣', '中辣', '重辣', '特辣', '变态辣']
      : ['未设置', '清淡', '适中', '偏重', '很重', '极重'];
  return typeof value === 'number' && Number.isInteger(value) && labels[value]
    ? labels[value]
    : '信息缺失';
};
const record = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined;
const rows = computed(() => {
  const before = record(props.draft.previewData?.before);
  const after = record(props.draft.previewData?.after);
  const changes: { key: string; label: string; before: string; after: string }[] = [];
  const preferences = record(after?.preferences);
  const tastes = record(preferences?.tastePreferences);
  if (preferences && 'tagPreferences' in preferences)
    changes.push({
      key: 'tags',
      label: '偏好标签',
      before: listText(before?.preferences?.tagPreferences),
      after: listText(preferences.tagPreferences),
    });
  if (preferences && 'priceRange' in preferences)
    changes.push({
      key: 'price',
      label: '每份价格',
      before: priceText(before?.preferences?.priceRange),
      after: priceText(preferences.priceRange),
    });
  for (const key of Object.keys(tasteFields) as (keyof typeof tasteFields)[]) {
    if (!tastes || !(key in tastes)) continue;
    changes.push({
      key,
      label: tasteFields[key],
      before: tasteText(before?.preferences?.tastePreferences?.[key], key),
      after: tasteText(tastes[key], key),
    });
  }
  if (preferences && 'avoidIngredients' in preferences)
    changes.push({
      key: 'avoid',
      label: '忌口食材',
      before: listText(before?.preferences?.avoidIngredients),
      after: listText(preferences.avoidIngredients),
    });
  if (after && 'allergens' in after)
    changes.push({
      key: 'allergens',
      label: '过敏原',
      before: listText(before?.allergens),
      after: listText(after.allergens),
    });
  return changes;
});

const handleAction = (action: Action) => {
  if (action === 'save' && !saveDisabled.value) emit('save', props.draft);
  if (action === 'dismiss' && !dismissDisabled.value) emit('dismiss', props.draft);
};
const handleKeydown = (event: KeyboardEvent, action: Action) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  pressedAction.value = action;
};
const handleKeyup = (event: KeyboardEvent, action: Action) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (pressedAction.value !== action) return;
  pressedAction.value = null;
  handleAction(action);
};
</script>

<style scoped>
.preference-card {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #1f2937;
  font-family: system-ui, sans-serif;
  overflow-wrap: anywhere;
}
.preference-title,
.preference-summary,
.preference-field,
.preference-message {
  display: block;
}
.preference-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}
.preference-summary {
  margin-top: 8px;
  font-size: 16px;
  line-height: 1.65;
}
.preference-message {
  margin-top: 8px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}
.preference-preview {
  margin-top: 16px;
}
.preference-columns {
  display: flex;
  gap: 16px;
  font-size: 16px;
  line-height: 1.6;
}
.preference-value {
  flex: 1;
  min-width: 0;
  white-space: normal;
}
.preference-column-headings {
  color: #667085;
  font-size: 13px;
}
.preference-row {
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}
.preference-field {
  margin-bottom: 4px;
  color: #4b5563;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}
.preference-error {
  color: #b42318;
}
.preference-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.preference-action {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  min-height: 44px;
  margin: 0;
  padding: 8px 16px;
  border: 0;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 140ms ease-out;
}
.preference-action::after {
  border: none;
}
.preference-save {
  color: #fff;
  background: #660874;
}
.preference-dismiss {
  color: #4b5563;
  background: #f4f4f5;
}
.preference-action[disabled] {
  color: #667085;
  background: #f7f8fa;
  cursor: default;
}
.preference-save.preference-control-pressed:not([disabled]) {
  background: #50065b;
}
.preference-dismiss.preference-control-pressed:not([disabled]) {
  background: #e5e7eb;
}
.preference-action:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
@media (hover: hover) {
  .preference-save:not([disabled]):hover {
    background: #50065b;
  }
  .preference-dismiss:not([disabled]):hover {
    background: #e5e7eb;
  }
}
@media (prefers-reduced-motion: reduce) {
  .preference-action {
    transition: none;
  }
}
</style>
