<template>
  <image
    class="ui-icon"
    :src="`/static/icons/ui/${name}-${tone}.png`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    mode="aspectFit"
    aria-hidden="true"
  />
</template>

<script lang="ts">
export type UiIconName =
  | 'user'
  | 'bell'
  | 'settings'
  | 'edit'
  | 'bookmark'
  | 'history'
  | 'star'
  | 'shield'
  | 'eye'
  | 'eye-off'
  | 'chevron-right'
  | 'chevron-down'
  | 'plus'
  | 'close'
  | 'trash'
  | 'calendar'
  | 'chat'
  | 'users'
  | 'search'
  | 'info'
  | 'logout';

export type UiIconTone = 'muted' | 'primary' | 'inverse' | 'danger';
</script>

<script setup lang="ts">
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
