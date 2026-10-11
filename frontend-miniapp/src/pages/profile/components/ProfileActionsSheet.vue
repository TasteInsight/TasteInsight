<template>
  <view class="profile-actions-mask" @click="cancelButton.activate">
    <view
      ref="sheetRef"
      class="profile-actions-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="个人资料"
      @click.stop
    >
      <view class="profile-actions-group">
        <button
          v-for="(item, index) in items"
          :key="item"
          class="profile-actions-option"
          role="button"
          tabindex="0"
          @click="itemButtons[index].activate"
          @keydown="itemButtons[index].handleKeydown"
          @keyup="itemButtons[index].handleKeyup"
          @blur="itemButtons[index].clearPress"
        >
          {{ item }}
        </button>
      </view>
      <button
        class="profile-actions-option profile-actions-cancel"
        role="button"
        tabindex="0"
        @click="cancelButton.activate"
        @keydown="cancelButton.handleKeydown"
        @keyup="cancelButton.handleKeyup"
        @blur="cancelButton.clearPress"
      >
        取消
      </button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useButtonActivation } from '@/composables/use-button-activation';
const props = withDefaults(defineProps<{ items: string[]; canRestoreFocus?: () => boolean }>(), {
  canRestoreFocus: () => true,
});
const emit = defineEmits<{ (event: 'select', index: number): void; (event: 'close'): void }>();
const itemButtons = computed(() =>
  props.items.map((_, index) => useButtonActivation(() => emit('select', index)))
);
const cancelButton = useButtonActivation(() => emit('close'));
const sheetRef = ref<HTMLElement | { $el: HTMLElement } | null>(null);
let focusOrigin: HTMLElement | null = null;
let mounted = true;
const sheetElement = () =>
  sheetRef.value instanceof HTMLElement ? sheetRef.value : sheetRef.value?.$el;
const controls = () =>
  sheetElement()?.querySelectorAll<HTMLElement>('[role="button"][tabindex="0"]');
function handleKeyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancelButton.activate();
    return;
  }
  if (event.key !== 'Tab') return;
  const buttons = controls();
  if (!buttons?.length) return;
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (!sheetElement()?.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
onMounted(async () => {
  focusOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener('keydown', handleKeyboard);
  await nextTick();
  if (mounted) controls()?.[0]?.focus();
});
onBeforeUnmount(() => {
  mounted = false;
  document.removeEventListener('keydown', handleKeyboard);
  if (props.canRestoreFocus() && focusOrigin?.isConnected) focusOrigin.focus();
});
</script>
<style scoped>
.profile-actions-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 24, 39, 0.36);
}
.profile-actions-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 680px;
  max-height: calc(100vh - 24px);
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
  overflow-y: auto;
}
.profile-actions-group {
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
}
.profile-actions-option {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  min-height: 48px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  background: #fff;
  color: #1f2937;
  font-size: 14px;
  line-height: 24px;
}
.profile-actions-option::after {
  border: 0;
}
.profile-actions-option:active {
  background: #f4f4f5;
}
.profile-actions-option:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -3px;
}
.profile-actions-option:last-child {
  border-bottom: 0;
}
.profile-actions-cancel {
  margin-top: 6px;
  border-bottom: 0;
  border-radius: 16px;
}
</style>
