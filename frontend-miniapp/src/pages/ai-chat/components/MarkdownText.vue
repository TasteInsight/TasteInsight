<template>
  <rich-text :nodes="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { markdownToRichTextHtml } from '../utils/markdown';

const props = defineProps<{
  content: string;
}>();

const html = computed(() => markdownToRichTextHtml(props.content));
</script>
