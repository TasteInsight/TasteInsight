<template>
  <view class="empty-state" :role="role" :aria-busy="loading">
    <view v-if="loading" class="empty-state__spinner" aria-hidden="true" />
    <UiIcon v-else :name="icon" :size="28" />
    <text class="empty-state__title">{{ title }}</text>
    <text v-if="description" class="empty-state__description">{{ description }}</text>
    <button
      v-if="actionText"
      class="empty-state__action"
      role="button"
      tabindex="0"
      @click="activate"
      @keydown="handleKeydown"
      @keyup="handleKeyup"
      @blur="clearPress"
    >
      {{ actionText }}
    </button>
  </view>
</template>

<script setup lang="ts">
import UiIcon, { type UiIconName } from './UiIcon.vue';
import { useButtonActivation } from '@/composables/use-button-activation';

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    icon?: UiIconName;
    actionText?: string;
    loading?: boolean;
    role?: 'status' | 'alert';
  }>(),
  {
    description: '',
    loading: false,
    role: 'status',
    icon: 'info',
    actionText: '',
  }
);

const emit = defineEmits<{ (event: 'action'): void }>();
const { activate, handleKeydown, handleKeyup, clearPress } = useButtonActivation(() =>
  emit('action')
);
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  min-width: 0;
  padding: 28px 20px;
  text-align: center;
}

.empty-state__title {
  max-width: 100%;
  color: #667085;
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.empty-state__description {
  max-width: 32ch;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.empty-state__spinner {
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #660874;
  border-radius: 50%;
  animation: state-spin 800ms linear infinite;
}
@keyframes state-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .empty-state__spinner {
    animation: none;
  }
}

.empty-state__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  max-width: 100%;
  margin: 2px 0 0;
  padding: 10px 16px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #660874;
  font-size: 14px;
  font-weight: 600;
  line-height: 24px;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.empty-state__action::after {
  border: 0;
}

.empty-state__action:active {
  background: #f4f4f5;
}

.empty-state__action:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}

@media (hover: hover) {
  .empty-state__action:hover {
    background: #f4f4f5;
  }
}
</style>
