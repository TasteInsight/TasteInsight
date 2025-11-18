<template>
  <view
    class="w-full bg-white px-4 py-4 rounded-xl border border-ts-purple_f30 active:border-ts-purple transition-all flex items-center"
    hover-class="border-ts-purple"
    @click="$emit('click')"
  >
    <view class="flex items-center justify-between w-full">
      <view class="flex items-center">
        <text
          class="iconify text-purple-600"
          :data-icon="icon"
          data-width="24"
        ></text>
        <text class="ml-4 text-gray-800 font-medium text-base">
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