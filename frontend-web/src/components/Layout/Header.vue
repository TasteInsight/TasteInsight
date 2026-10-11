<template>
  <header class="admin-page-header" :class="{ 'border-b border-gray-200': showBorder }">
    <h2 class="text-2xl font-semibold text-gray-800 mb-1 flex items-center gap-2">
      <AppIcon class="iconify text-tsinghua-purple" :icon="headerIcon"></AppIcon>
      <span>{{ title }}</span>
    </h2>
    <p class="text-sm leading-6 text-gray-600">{{ description }}</p>
  </header>
</template>

<script>
export default {
  name: 'Header',
  props: {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    headerIcon: {
      type: String,
      required: true,
    },
    showBorder: {
      type: Boolean,
      default: true,
    },
  },
}
</script>
