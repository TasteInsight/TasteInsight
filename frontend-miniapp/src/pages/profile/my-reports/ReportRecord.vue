<template>
  <view class="report-record">
    <view class="report-heading">
      <text class="report-title">{{ targetLabel }}举报</text>
      <text class="report-status" :class="'report-status--' + item.status">{{ statusLabel }}</text>
    </view>
    <text class="report-reason"
      >{{ reasonLabel }}<template v-if="item.reason">：{{ item.reason }}</template></text
    >
    <text v-if="item.status !== 'pending'" class="report-result"
      >处理结论：{{ item.handleResult || statusLabel }}</text
    >
    <text class="report-time">提交时间 {{ formatDate(item.createdAt) }}</text>
    <text v-if="item.handledAt" class="report-time">处理时间 {{ formatDate(item.handledAt) }}</text>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import type { Report } from '@/types/api';
const props = defineProps<{ item: Report }>();
const targetLabel = computed(
  () =>
    ({ review: '评价', comment: '评价回复', post: '动态', postComment: '动态回复' })[
      props.item.targetType
    ] || '内容'
);
const statusLabel = computed(
  () => ({ pending: '处理中', approved: '举报成立', rejected: '举报未成立' })[props.item.status]
);
const reasonLabel = computed(
  () =>
    ({ spam: '垃圾广告', inappropriate: '不当内容', false_info: '不实信息', other: '其他问题' })[
      props.item.type
    ] || props.item.type
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
