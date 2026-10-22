<template>
  <view class="upload-item" :class="{ 'upload-focused': highlighted }">
    <view class="upload-main">
      <view class="upload-details">
        <view class="upload-title-row">
          <text class="upload-title">{{ item.name }}</text>
          <view class="upload-status" :class="'upload-status-' + item.status">
            <UiIcon :name="status.icon" :tone="status.tone" :size="14" />
            <text>{{ status.label }}</text>
          </view>
        </view>
        <text class="upload-location">{{ location }}</text>
        <DishNutrition :dish="item" />
        <text class="upload-meta"
          >{{
            item.kind === 'update'
              ? t('account.profile.additionalDetails')
              : t('account.profile.newDish')
          }}
          · {{ formatDate(item.createdAt) }}</text
        >
      </view>
      <image
        v-if="imageSource && !imageFailed"
        :key="imageSource"
        class="upload-photo"
        :src="imageSource"
        :alt="item.name"
        mode="aspectFill"
        @error="imageFailed = true"
      />
    </view>
    <text v-if="item.status === 'rejected' && item.rejectReason" class="upload-reason">{{
      t('account.profile.reason', { reason: item.rejectReason })
    }}</text>
    <view class="upload-footer">
      <text class="upload-price"
        >¥{{ item.price
        }}<text class="upload-unit">{{ priceUnitSuffix(item.priceUnit) }}</text></text
      >
      <view class="upload-actions">
        <button
          v-if="item.status === 'approved' && item.approvedDishId"
          class="upload-action"
          @click="emit('openDish', item.approvedDishId)"
        >
          {{ t('account.profile.viewDish') }}<UiIcon name="chevron-right" :size="14" />
        </button>
        <template v-if="item.status === 'pending' || item.status === 'rejected'">
          <button
            class="upload-action"
            :class="{ 'is-disabled': actionsDisabled }"
            :disabled="actionsDisabled"
            @click="emit('edit')"
          >
            {{ t('account.profile.editDetails') }}
          </button>
          <button
            class="upload-action upload-secondary"
            :class="{ 'is-disabled': actionsDisabled }"
            :disabled="actionsDisabled"
            @click="emit('withdraw')"
          >
            {{ withdrawing ? t('account.profile.withdrawing') : t('account.profile.withdraw') }}
          </button>
        </template>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import UiIcon from '@/components/UiIcon.vue';
import DishNutrition from '@/components/DishNutrition.vue';
import type { UiIconName, UiIconTone } from '@/types/ui-icon';
import { priceUnitSuffix } from '@/utils/price-display';
import type { MyUploadItem, DishContributionStatus } from '@/types/api';
const props = defineProps<{
  item: MyUploadItem;
  highlighted?: boolean;
  actionsDisabled?: boolean;
  withdrawing?: boolean;
}>();
const emit = defineEmits<{ edit: []; withdraw: []; openDish: [id: string] }>();
const statuses = computed<
  Record<DishContributionStatus, { label: string; icon: UiIconName; tone: UiIconTone }>
>(() => ({
  pending: { label: t('account.profile.pendingReview'), icon: 'history', tone: 'muted' },
  approved: { label: t('account.profile.accepted'), icon: 'shield', tone: 'muted' },
  rejected: { label: t('account.profile.unsuccessful'), icon: 'info', tone: 'danger' },
  withdrawn: { label: t('account.profile.withdrawn'), icon: 'close', tone: 'muted' },
}));
const status = computed(() => statuses.value[props.item.status]);
const location = computed(() =>
  [props.item.canteenName, props.item.windowName].filter(Boolean).join(' · ')
);
const imageSource = computed(() => props.item.images?.[0] || '');
const imageFailed = ref(false);
watch(
  () => [props.item.id, imageSource.value],
  () => {
    imageFailed.value = false;
  }
);
const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');
</script>
<style scoped>
.upload-item {
  padding: 16px 0 12px;
  border-bottom: 1px solid #eaecf0;
}
.upload-focused {
  animation: upload-highlight 2s ease-out;
}
.upload-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.upload-details {
  flex: 1;
  min-width: 0;
}
.upload-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.upload-title {
  flex: 1;
  min-width: 0;
  color: #1f2937;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.upload-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding-top: 2px;
  font-size: 12px;
  line-height: 1.6;
  color: #667085;
}
.upload-status-approved {
  color: #2f6b50;
}
.upload-status-rejected {
  color: #b42318;
}
.upload-location,
.upload-meta,
.upload-reason {
  display: block;
  margin-top: 4px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.upload-location {
  color: #475467;
  font-size: 13px;
}
.upload-meta {
  color: #667085;
  font-size: 12px;
}
.upload-photo {
  display: block;
  flex: 0 0 60px;
  width: 60px;
  height: 60px;
  border-radius: 8px;
}
.upload-reason {
  margin-top: 8px;
  color: #b42318;
  font-size: 13px;
}
.upload-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  min-height: 44px;
  margin-top: 4px;
}
.upload-price {
  color: var(--color-price, #2f6b50);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.upload-unit {
  color: #667085;
  font-size: 12px;
  font-weight: 400;
}
.upload-actions {
  display: flex;
  gap: 16px;
  margin-left: auto;
  flex-wrap: wrap;
}
.upload-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  min-width: 44px;
  flex-shrink: 0;
  margin: 0;
  padding: 8px 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #660874;
  font-size: 13px;
  line-height: 1.5;
}
.upload-action::after {
  border: 0;
}
.upload-action:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.upload-action:active {
  background: #f9f5fa;
}
.upload-action.is-disabled {
  opacity: 0.55;
}
.upload-secondary {
  color: #667085;
}
@keyframes upload-highlight {
  from {
    background-color: #f2f4f7;
  }
  to {
    background-color: transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .upload-focused {
    animation: none;
    background-color: #f7f8fa;
  }
}
</style>
