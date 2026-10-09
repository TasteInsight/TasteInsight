<template>
  <view class="taste-profile">
    <view
      class="taste-heading"
      :class="{ 'taste-heading-collapsed': collapsible && (!taste || !expanded) }"
    >
      <slot name="summary">
        <text v-if="!collapsible" class="taste-title">口味</text>
      </slot>
      <button
        v-if="collapsible && taste"
        class="discussion-action taste-toggle"
        role="button"
        tabindex="0"
        :aria-expanded="expanded"
        :aria-controls="detailsId"
        :aria-label="expanded ? '收起口味明细' : '展开口味明细'"
        @tap.stop="toggleDetails"
        @keydown.enter.stop.prevent="toggleDetails"
        @keydown.space.stop.prevent="toggleDetails"
      >
        <text>口味明细</text>
        <image
          class="taste-disclosure-icon"
          :class="{ 'taste-disclosure-icon-expanded': expanded }"
          src="/static/icons/chevron-down.png"
          mode="aspectFit"
          aria-hidden="true"
        />
      </button>
      <text v-else-if="!collapsible && taste" class="taste-direction" aria-hidden="true"
        >低 → 高</text
      >
    </view>
    <view v-if="collapsible && taste && expanded" class="taste-detail-heading">
      <text class="taste-direction" aria-hidden="true">低 → 高</text>
    </view>
    <view v-if="taste" :id="detailsId" v-show="!collapsible || expanded" class="taste-grid">
      <view
        v-for="item in items"
        :key="item.key"
        class="taste-profile-item"
        :data-taste="item.key"
        role="img"
        :aria-label="
          item.level > 0
            ? `${item.label}，强度 ${item.level}，共 5 级，从低到高`
            : `${item.label}，暂无信息`
        "
      >
        <text class="taste-label" aria-hidden="true">{{ item.label }}</text>
        <view v-if="item.level > 0" class="taste-level" aria-hidden="true">
          <view
            v-for="step in 5"
            :key="step"
            class="taste-segment"
            :class="{ 'taste-segment-active': step <= item.level }"
          />
        </view>
        <text v-else class="taste-unknown" aria-hidden="true">暂无信息</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue';
import type { Dish } from '@/types/api';

const props = withDefaults(
  defineProps<{
    taste?: Pick<Dish, 'spicyLevel' | 'sweetness' | 'saltiness' | 'oiliness'> | null;
    collapsible?: boolean;
  }>(),
  { collapsible: false }
);
const expanded = ref(false);
const detailsId = `taste-details-${getCurrentInstance()!.uid}`;
const toggleDetails = () => {
  expanded.value = !expanded.value;
};

const fields = [
  { key: 'spicyLevel', label: '辣度' },
  { key: 'sweetness', label: '甜度' },
  { key: 'saltiness', label: '咸度' },
  { key: 'oiliness', label: '油腻度' },
] as const;

const items = computed(() =>
  fields.map(field => ({ ...field, level: props.taste?.[field.key] ?? 0 }))
);
</script>

<style scoped>
@import './discussion.css';
.taste-profile {
  color: #1f2937;
  font-family: inherit;
}
.taste-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.taste-heading-collapsed {
  margin-bottom: 0;
}
.taste-toggle {
  padding: 0 6px;
  margin-left: auto;
  gap: 6px;
}
.taste-toggle.button-hover,
.taste-toggle:active {
  background: #f4f4f5;
  color: #475467;
  opacity: 1;
}
.taste-disclosure-icon {
  width: 18px;
  height: 18px;
  transition: transform 160ms ease-out;
}
.taste-disclosure-icon-expanded {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .taste-disclosure-icon {
    transition: none;
  }
}
.taste-title {
  font-size: 14px;
  line-height: 1.5;
}
.taste-direction {
  color: #667085;
  font-size: 11px;
  line-height: 1.5;
}
.taste-detail-heading {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.taste-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
}
.taste-profile-item {
  width: calc(50% - 10px);
  min-width: 0;
}
.taste-label {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 5px;
}
.taste-level {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 16px;
}
.taste-segment {
  flex: 1;
  height: 6px;
  border-radius: 2px;
  background: #e5e7eb;
}
.taste-segment-active {
  background: #667085;
}
.taste-unknown {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 16px;
}
</style>
