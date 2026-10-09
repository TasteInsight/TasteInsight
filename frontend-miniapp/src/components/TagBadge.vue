<template>
  <text class="tag-badge" :class="`tag-badge--${palette}`">{{ label }}</text>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ label: string; tone?: 'identity' | 'neutral' }>(), {
  tone: 'identity',
});
const palettes = ['green', 'amber', 'slate'] as const;
const palette = computed(() => {
  if (props.tone === 'neutral') return 'neutral';
  let identity = 0;
  for (const character of props.label.trim()) {
    identity = (identity * 31 + character.codePointAt(0)!) >>> 0;
  }
  return palettes[identity % palettes.length];
});
</script>

<style scoped>
.tag-badge {
  display: inline-block;
  max-width: 100%;
  padding: 2px 9px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  white-space: normal;
  overflow-wrap: anywhere;
  box-sizing: border-box;
  vertical-align: middle;
}
.tag-badge--green {
  border-color: #d7e6db;
  background: #edf5ef;
  color: #35634c;
}
.tag-badge--amber {
  border-color: #eddfc2;
  background: #fbf3e4;
  color: #855f1f;
}
.tag-badge--slate {
  border-color: #dce2e9;
  background: #f0f3f7;
  color: #4d5c70;
}
.tag-badge--neutral {
  border-color: #eaecf0;
  background: #f4f4f5;
  color: #475467;
}
</style>
