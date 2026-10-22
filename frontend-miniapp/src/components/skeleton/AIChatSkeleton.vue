<template>
  <view class="chat-loading" role="status" :aria-label="t('common.skeleton.ai')">
    <text class="chat-loading-label">{{ t('common.skeleton.aiLabel') }}</text>
    <SkeletonBase width="80%" height="16px" rounded="rounded" />
    <SkeletonBase width="60%" height="16px" rounded="rounded" />
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';

import SkeletonBase from './SkeletonBase.vue';
</script>
<style scoped>
.chat-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  background: #fff;
}
.chat-loading-label {
  color: #667085;
  font-size: 14px;
  line-height: 1.65;
}
</style>
