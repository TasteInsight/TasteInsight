<template>
  <!-- 长按操作菜单 -->
  <view 
    v-if="visible" 
    class="fixed inset-0 z-[1500]"
    @tap="handleClose"
  >
    <!-- 菜单弹窗 -->
    <view 
      class="absolute bg-white rounded-lg shadow-lg overflow-hidden"
      :style="{ top: `${position.y}px`, left: `${position.x}px` }"
      @tap.stop
    >
      <!-- 删除选项 -->
      <view 
        class="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
        :class="canDelete ? 'cursor-pointer active:bg-gray-50' : 'opacity-40 cursor-not-allowed'"
        @tap="handleDelete"
      >
        <text class="text-base" :class="canDelete ? 'text-red-500' : 'text-gray-400'">🗑️</text>
        <text class="text-sm" :class="canDelete ? 'text-gray-700' : 'text-gray-400'">删除</text>
      </view>
      
      <!-- 举报选项 -->
      <view 
        class="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50"
        @tap="handleReport"
      >
        <text class="text-base text-orange-500">⚠️</text>
        <text class="text-sm text-gray-700">举报</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean;
  position: { x: number; y: number };
  canDelete: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'delete'): void;
  (e: 'report'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const handleClose = () => {
  emit('close');
};

const handleDelete = () => {
  emit('delete');
};

const handleReport = () => {
  emit('report');
};
</script>

<style scoped>
/* 菜单样式 */
</style>
