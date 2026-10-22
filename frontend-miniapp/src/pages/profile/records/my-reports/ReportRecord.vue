<template>
  <view class="report-record">
    <view class="report-heading">
      <text class="report-title">{{ t('account.profile.report', { target: targetLabel }) }}</text>
      <text class="report-status" :class="'report-status--' + item.status">{{ statusLabel }}</text>
    </view>
    <text class="report-reason"
      >{{ reasonLabel }}<template v-if="item.reason">：{{ item.reason }}</template></text
    >
    <text v-if="item.status !== 'pending'" class="report-result">{{
      t('account.profile.outcome', { result: item.handleResult || statusLabel })
    }}</text>
    <text class="report-time">{{
      t('account.profile.submitted', { date: formatDate(item.createdAt) })
    }}</text>
    <text v-if="item.handledAt" class="report-time">{{
      t('account.profile.handled', { date: formatDate(item.handledAt) })
    }}</text>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed } from 'vue';
import dayjs from 'dayjs';
import type { Report } from '@/types/api';
const props = defineProps<{ item: Report }>();
const targetLabel = computed(
  () =>
    ({
      review: t('account.profile.reviews'),
      comment: t('account.profile.reviewReply'),
      post: t('account.profile.posts'),
      postComment: t('account.profile.postReply'),
    })[props.item.targetType] || t('account.profile.content')
);
const statusLabel = computed(
  () =>
    ({
      pending: t('account.profile.inProgress'),
      approved: t('account.profile.reportUpheld'),
      rejected: t('account.profile.reportDismissed'),
    })[props.item.status]
);
const reasonLabel = computed(
  () =>
    ({
      spam: t('account.profile.spamOrAdvertising'),
      inappropriate: t('account.profile.inappropriateContent'),
      false_info: t('account.profile.falseInformation'),
      other: t('account.profile.otherIssue'),
    })[props.item.type] || props.item.type
);
const formatDate = (date: string) => dayjs(date).format('YYYY/M/D HH:mm');
</script>
<style scoped>
.report-record {
  padding: 20px 0;
  border-bottom: 1px solid #eef0f3;
}
.report-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.report-title {
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}
.report-status {
  color: #475467;
  font-size: 13px;
  flex-shrink: 0;
}
.report-status--approved {
  color: #660874;
}
.report-reason,
.report-result {
  display: block;
  color: #344054;
  font-size: 14px;
  line-height: 1.6;
  margin-top: 10px;
  overflow-wrap: anywhere;
}
.report-time {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 8px;
  font-variant-numeric: tabular-nums;
}
</style>
