<template>
  <button
    class="floating-action-button"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-label="label"
    :class="{ 'is-disabled': disabled }"
    :disabled="disabled"
    @click="activate"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
    @blur="clearPress"
  >
    <UiIcon :name="icon" :size="22" tone="inverse" />
    <text>{{ label }}</text>
  </button>
</template>

<script setup lang="ts">
import UiIcon from './UiIcon.vue';
import type { UiIconName } from '@/types/ui-icon';
import { useButtonActivation } from '@/composables/use-button-activation';

const props = withDefaults(defineProps<{ label: string; icon: UiIconName; disabled?: boolean }>(), {
  disabled: false,
});
const emit = defineEmits<{ click: [] }>();
const { activate, handleKeydown, handleKeyup, clearPress } = useButtonActivation(
  () => emit('click'),
  () => props.disabled
);
</script>

<style scoped>
.floating-action-button {
  position: fixed;
  right: 20px;
  bottom: calc(var(--window-bottom, 0px) + 20px + env(safe-area-inset-bottom));
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  background: #660874;
  color: #fff;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.14);
}
.floating-action-button::after {
  border: 0;
}
.floating-action-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
}
.floating-action-button:not(.is-disabled):active {
  opacity: 0.72;
}
.floating-action-button.is-disabled {
  background: #660874;
  color: #fff;
  opacity: 0.55;
}
</style>
