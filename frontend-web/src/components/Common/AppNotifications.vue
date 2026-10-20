<template>
  <Toaster
    close-button-position="top-right"
    position="top-right"
    theme="light"
    rich-colors
    close-button
    :visible-toasts="3"
    container-aria-label="操作通知"
    :toast-options="{ closeButtonAriaLabel: '关闭通知' }"
  />
</template>
<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
</script>
