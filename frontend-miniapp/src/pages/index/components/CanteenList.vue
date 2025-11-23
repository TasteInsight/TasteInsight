<template>
  <view class="w-24 h-24 flex flex-col items-center justify-center rounded-lg mr-3 bg-white shadow-sm cursor-pointer flex-shrink-0">
    <img :src="canteen.images[0] || '/default-canteen.png'" :alt="canteen.name" class="w-12 h-12" style="object-fit:contain" />
    <span class="mt-2 font-medium">{{ canteen.name }}</span>
  </view>
</template>

<script setup lang="ts">
import type { Canteen } from '@/types/api';

defineProps<{
  canteen: Canteen;
}>();
</script>

