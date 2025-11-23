<template>
  <div 
    class="bg-white rounded-lg p-4 mb-2 shadow-sm"
    @click="handleClick"
  >
    <div class="flex items-center gap-3">
      <img 
        v-if="canteen.images?.[0]" 
        :src="canteen.images[0]" 
        class="w-16 h-16 rounded-lg object-cover"
      />
      <div v-else class="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
        <text class="iconify text-gray-400" data-icon="mdi:store"></text>
      </div>
      <div class="flex-1">
        <div class="font-semibold text-gray-800">{{ canteen.name }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ canteen.description || '暂无描述' }}</div>
        <div v-if="canteen.averageRating" class="text-xs text-yellow-600 mt-1">
          ⭐ {{ canteen.averageRating.toFixed(1) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Canteen } from '@/types/api';

interface Props {
  canteen: Canteen;
}

const props = defineProps<Props>();

const handleClick = () => {
  uni.navigateTo({
    url: `/pages/canteen/detail?id=${props.canteen.id}`
  });
};
</script>
