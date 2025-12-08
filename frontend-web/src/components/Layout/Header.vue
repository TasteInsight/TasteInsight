<template>
  <div class="p-6 border-b border-gray-200">
    <h2 class="text-2xl font-semibold text-gray-800 mb-1 flex items-center space-x-2">
      <span class="iconify text-tsinghua-purple" :data-icon="headerIcon"></span>
      <span>{{ title }}</span>
    </h2>
    <p class="text-gray-500">{{ description }}</p>
  </div>
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
  },
}
</script>
