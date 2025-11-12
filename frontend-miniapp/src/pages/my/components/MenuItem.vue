<template>
  <view 
    class="w-full bg-white px-6 py-4 rounded-xl shadow-md border border-purple-100 active:shadow-lg active:border-purple-300 transition-all"
    hover-class="shadow-lg border-purple-300"
    @click="$emit('click')"
  >
    <view class="flex items-center justify-between">
      <view class="flex items-center">
        <text 
          class="iconify text-purple-600" 
          :data-icon="icon" 
          data-width="24"
        ></text>
        <text class="ml-4 text-gray-800 font-medium">
          {{ title }}
        </text>
      </view>
      <text 
        class="iconify text-gray-400" 
        data-icon="mdi:chevron-right" 
        data-width="20"
      ></text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
}>();

defineEmits(['click']);
</script>