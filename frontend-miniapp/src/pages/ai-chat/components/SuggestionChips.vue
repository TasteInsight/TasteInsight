<template>
  <scroll-view 
    scroll-x 
    class="w-full" 
    :show-scrollbar="false"
    :enhanced="true"
  >
    <view class="flex flex-nowrap gap-2 px-4 py-2">
      <view 
        v-for="(suggestion, index) in suggestions" 
        :key="index"
        class="flex-shrink-0 bg-white border border-ts-purple/20 text-ts-purple text-sm px-3 py-1.5 rounded-full shadow-sm active:bg-ts-purple/10 transition-colors cursor-pointer"
        @click="$emit('select', suggestion)"
      >
        {{ suggestion }}
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
defineProps<{
  suggestions: string[];
}>();

defineEmits<{
  (e: 'select', text: string): void;
}>();
</script>
