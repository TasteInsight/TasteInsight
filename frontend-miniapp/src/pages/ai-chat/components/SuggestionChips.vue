<template>
  <view class="flex flex-wrap gap-2 px-4 py-2">
    <view 
      v-for="(suggestion, index) in suggestions" 
      :key="index"
      class="bg-white border border-ts-purple/20 text-ts-purple text-sm px-3 py-1.5 rounded-full shadow-sm active:bg-ts-purple/10 transition-colors cursor-pointer"
      @click="$emit('select', suggestion)"
    >
      {{ suggestion }}
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  suggestions: string[];
}>();

defineEmits<{
  (e: 'select', text: string): void;
}>();
</script>
