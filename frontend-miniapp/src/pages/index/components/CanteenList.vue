<template>
  <div class="canteen-card">
    <img :src="canteen.images[0] || '/default-canteen.png'" :alt="canteen.name" class="w-12 h-12" style="object-fit:contain" />
    <span class="mt-2 font-medium">{{ canteen.name }}</span>
  </div>
</template>

<script setup lang="ts">
import type { Canteen } from '@/types/api';

defineProps<{
  canteen: Canteen;
}>();
</script>

<style scoped>
.canteen-card {
  width: 100px;
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  margin-right: 12px;
  background: white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  flex-shrink: 0; /* 防止在 flex 布局中被压缩 */
}
</style>