<template>
  <view class="px-4">
    <view class="flex flex-wrap py-3">
      <view 
        v-for="filter in filters" 
        :key="filter.key"
        class="inline-flex items-center border rounded-full h-8 px-3 text-sm mr-2 mb-2 cursor-pointer"
        :class="activeFilter === filter.key ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-700 border-purple-300'"
        @tap="() => toggle(filter.key)"
      >
        <span>{{ filter.label }}</span>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';

const props = defineProps<{ filters: Array<{ key: string; label: string }>; activeFilter: string | null }>();
const emit = defineEmits<{ (e: 'toggle', key: string): void }>();

const toggle = (key: string) => {
  emit('toggle', key);
};
</script>
