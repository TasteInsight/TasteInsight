<template>
  <view class="planning-card">
    <view class="plan-header">
      <text class="plan-title">饮食规划建议</text>
    </view>
    
    <view class="plan-content">
      <text class="plan-summary">{{ plan.summary }}</text>
      
      <!-- 如果有预览数据，可以在这里展示更详细的信息 -->
      <view v-if="plan.previewData" class="plan-details">
        <!-- 简单展示预览数据，实际可根据结构优化 -->
        <view v-for="(value, key) in plan.previewData" :key="key" class="detail-item">
          <text class="detail-key">{{ key }}: </text>
          <text class="detail-value">{{ value }}</text>
        </view>
      </view>
    </view>

    <view class="plan-actions">
      <button class="action-btn discard" @click="handleDiscard">放弃</button>
      <button class="action-btn apply" @click="handleApply">应用规划</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { ComponentMealPlanDraft } from '@/types/api';

const props = defineProps<{
  plan: ComponentMealPlanDraft;
}>();

const emit = defineEmits<{
  (e: 'apply', plan: ComponentMealPlanDraft): void;
  (e: 'discard'): void;
}>();

const handleApply = () => {
  emit('apply', props.plan);
};

const handleDiscard = () => {
  emit('discard');
};
</script>

<style scoped lang="scss">
.planning-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.plan-header {
  margin-bottom: 12px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.plan-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.plan-content {
  margin-bottom: 16px;
}

.plan-summary {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.plan-details {
  margin-top: 8px;
  background: #f9f9f9;
  padding: 8px;
  border-radius: 8px;
}

.detail-item {
  font-size: 12px;
  margin-bottom: 4px;
}

.detail-key {
  color: #888;
}

.detail-value {
  color: #333;
}

.plan-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  font-size: 14px;
  padding: 8px 0;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  
  &.discard {
    background: #f5f5f5;
    color: #666;
  }
  
  &.apply {
    background: #82318E;
    color: white;
  }
}
</style>
