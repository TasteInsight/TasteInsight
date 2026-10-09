<template>
  <Icon :icon="icon" :data-icon="icon" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{ icon: string }>()
</script>
