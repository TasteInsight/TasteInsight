<template>
  <view class="suggestions" role="group" :aria-label="t('social.suggestedQuestions')">
    <button
      v-for="(suggestion, index) in suggestions"
      :key="index"
      class="suggestion-chip"
      hover-class="suggestion-chip-pressed"
      :hover-stay-time="80"
      role="button"
      tabindex="0"
      :aria-label="suggestion"
      :class="{ 'is-disabled': disabled }"
      :disabled="disabled"
      @click="select(suggestion)"
      @keydown="handleKeydown"
      @keyup="handleKeyup($event, suggestion)"
      @blur="pressed = false"
    >
      {{ suggestion }}
    </button>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { ref } from 'vue';
const props = defineProps<{ suggestions: string[]; disabled?: boolean }>();
const emit = defineEmits<{ (e: 'select', text: string): void }>();
const pressed = ref(false);
const select = (text: string) => {
  if (!props.disabled) emit('select', text);
};
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    pressed.value = true;
  }
};
const handleKeyup = (event: KeyboardEvent, text: string) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (pressed.value) {
    pressed.value = false;
    select(text);
  }
};
</script>
<style scoped>
.suggestions {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}
.suggestion-chip {
  flex-shrink: 1;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 44px;
  max-width: 260px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #eceef1;
  border-radius: 999px;
  background: #fff;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
  cursor: pointer;
  transition: background-color 140ms ease-out;
}
.suggestion-chip::after {
  border: none;
}
.suggestion-chip:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.suggestion-chip.is-disabled {
  color: #667085;
  background: #fff;
}
.suggestion-chip.suggestion-chip-pressed:not(.is-disabled) {
  background: #f4f4f5;
}
@media (hover: hover) {
  .suggestion-chip:not(.is-disabled):hover {
    background: #f7f8fa;
  }
}
</style>
