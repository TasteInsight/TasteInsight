<template>
  <view 
    class="w-[calc(100%-32px)] bg-white px-4 py-4 h-12 rounded-xl shadow-lg border border-purple-600 active:shadow-xl active:border-purple-800 transition-all flex items-center"
    hover-class="shadow-xl border-purple-800"
    @click="$emit('click')"
  >
    <view class="flex items-center justify-between w-full">
      <view class="flex items-center">
        <text 
          class="iconify text-purple-600" 
          :data-icon="icon" 
          data-width="24"
        ></text>
        <text class="ml-4 text-gray-800 font-medium text-lg">
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