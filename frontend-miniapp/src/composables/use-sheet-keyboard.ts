import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

export function useSheetKeyboard(onViewportChange?: () => void | Promise<void>) {
  const inset = ref(0);
  let initialHeight = 0;
  const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
  const updateViewport = () => {
    if (viewport) {
      inset.value = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      void onViewportChange?.();
    }
  };
  const updateKeyboard = ({ height }: { height: number }) => {
    const resizedBy = Math.max(
      0,
      initialHeight - (uni.getSystemInfoSync().windowHeight || initialHeight)
    );
    inset.value = Math.max(0, height - resizedBy);
    void onViewportChange?.();
  };
  onMounted(() => {
    if (typeof window !== 'undefined') {
      viewport?.addEventListener('resize', updateViewport);
      viewport?.addEventListener('scroll', updateViewport);
      updateViewport();
    } else {
      initialHeight = uni.getSystemInfoSync().windowHeight;
      uni.onKeyboardHeightChange?.(updateKeyboard);
    }
  });
  onUnmounted(() => {
    viewport?.removeEventListener('resize', updateViewport);
    viewport?.removeEventListener('scroll', updateViewport);
    if (typeof window === 'undefined') uni.offKeyboardHeightChange?.(updateKeyboard);
  });
  return computed(() => ({
    bottom: `calc(var(--window-bottom, 0px) + ${inset.value}px)`,
    '--sheet-safe-bottom': inset.value ? '0px' : 'env(safe-area-inset-bottom)',
  }));
}

export function useSheetInputScroll() {
  const scrollIntoView = ref('');
  let focusedField = '';
  let revealVersion = 0;
  let active = true;

  const revealFocusedField = async () => {
    if (!active || !focusedField) return;
    const field = focusedField;
    const version = ++revealVersion;
    // 同一字段需要在视口变化后重新触发原生 scroll-into-view。
    scrollIntoView.value = '';
    await nextTick();
    if (active && version === revealVersion && focusedField === field) scrollIntoView.value = field;
  };
  const focusField = (field: string) => {
    focusedField = field;
    return revealFocusedField();
  };
  const blurField = () => {
    focusedField = '';
    revealVersion++;
    scrollIntoView.value = '';
  };
  onUnmounted(() => {
    active = false;
    blurField();
  });
  return { scrollIntoView, focusField, blurField, revealFocusedField };
}
