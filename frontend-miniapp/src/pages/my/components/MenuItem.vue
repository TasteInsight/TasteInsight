<!-- @/pages/profile/components/MenuItem.vue -->
<template>
  <div class="card" @click="emit('click')">
    <div class="flex items-center py-3">
      <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
        <span class="iconify text-purple-700" :data-icon="icon" data-width="20"></span>
      </div>
      <div class="ml-4 flex-grow">
        <div class="font-medium">{{ title }}</div>
      </div>
      <span class="iconify text-gray-400" data-icon="mdi:chevron-right" data-width="20"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
}>();

const emit = defineEmits(['click']);
</script>

<style scoped>
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 0 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}
.card:active {
  transform: scale(0.98);
}
</style>