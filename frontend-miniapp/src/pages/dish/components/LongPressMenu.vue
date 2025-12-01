<template>
  <!-- 底部操作菜单 -->
  <view 
    v-if="visible" 
    class="fixed inset-0 z-[1500] bg-black/40"
    @tap="handleClose"
  >
    <!-- 底部弹出菜单 -->
    <view 
      class="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-lg overflow-hidden"
      :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
      @tap.stop
    >
      <view class="flex items-center justify-start h-[65px] px-4 gap-6">
        <!-- 举报选项 -->
        <view 
          class="flex flex-col items-center justify-center w-16 cursor-pointer transition-all duration-200 active:scale-95"
          @tap="handleReport"
        >
          <text class="text-xl text-orange-500">⚠️</text>
          <text class="text-xs text-gray-600 mt-1">举报</text>
        </view>

        <!-- 删除选项 - 仅自己的内容显示 -->
        <template v-if="canDelete">
          <view 
            class="flex flex-col items-center justify-center w-16 cursor-pointer transition-all duration-200 active:scale-95"
            @tap="handleDelete"
          >
            <text class="text-xl text-red-500">🗑️</text>
            <text class="text-xs text-gray-600 mt-1">删除</text>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean;
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
