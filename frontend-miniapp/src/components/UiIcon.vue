<template>
  <image
    class="ui-icon"
    :src="`/static/icons/ui/${name}-${tone}.png`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    mode="aspectFit"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import type { UiIconName, UiIconTone } from '@/types/ui-icon';

withDefaults(defineProps<{ name: UiIconName; size?: number; tone?: UiIconTone }>(), {
  size: 20,
  tone: 'muted',
});
</script>

<style scoped>
.ui-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  pointer-events: none;
}
</style>
