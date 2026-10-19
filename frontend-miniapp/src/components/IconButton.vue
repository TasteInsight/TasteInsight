<template>
  <button
    class="icon-button"
    :class="{ 'icon-button--inverse': tone === 'inverse', 'is-disabled': disabled }"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-label="label"
    :aria-pressed="pressed"
    :disabled="disabled"
    @click.stop="activate"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
    @blur="clearPress"
  >
    <UiIcon :name="name" :size="size" :tone="tone" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import UiIcon, { type UiIconName, type UiIconTone } from './UiIcon.vue';
import { useButtonActivation } from '@/composables/use-button-activation';

const props = withDefaults(
  defineProps<{
    name: UiIconName;
    label: string;
    size?: number;
    tone?: UiIconTone;
    disabled?: boolean;
    pressed?: boolean;
  }>(),
  { size: 20, tone: 'muted', disabled: false, pressed: undefined }
);
const emit = defineEmits<{ (event: 'click'): void }>();
const { activate, handleKeydown, handleKeyup, clearPress } = useButtonActivation(
  () => emit('click'),
  () => props.disabled
);
</script>

<style scoped>
.icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  line-height: 1;
  cursor: pointer;
}

.icon-button::after {
  border: 0;
}

.icon-button:not(.is-disabled):active {
  background: #f4f4f5;
}

.icon-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}

.icon-button--inverse:not(.is-disabled):active {
  background: rgba(255, 255, 255, 0.16);
}

.icon-button--inverse:focus-visible {
  outline-color: #fff;
}

.icon-button.is-disabled {
  background: transparent;
  opacity: 0.45;
  cursor: default;
}

@media (hover: hover) {
  .icon-button:not(.is-disabled):hover {
    background: #f4f4f5;
  }

  .icon-button--inverse:not(.is-disabled):hover {
    background: rgba(255, 255, 255, 0.16);
  }
}
</style>
