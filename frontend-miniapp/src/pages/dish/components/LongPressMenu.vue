<template>
  <view v-if="visible" class="action-menu-overlay" @tap.stop="handleClose">
    <view class="action-menu" role="dialog" aria-modal="true" aria-label="内容操作" @tap.stop>
      <button class="menu-action" @tap="handleReport">举报内容</button>
      <button v-if="canDelete" class="menu-action menu-delete" @tap="handleDelete">删除内容</button>
      <button class="menu-action menu-cancel" @tap="handleClose">取消</button>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; canDelete: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'delete'): void; (e: 'report'): void }>();
const handleClose = () => emit('close');
const handleDelete = () => emit('delete');
const handleReport = () => emit('report');
</script>

<style scoped>
.action-menu-overlay {
  position: fixed;
  z-index: 4000;
  top: var(--window-top, 0px);
  bottom: var(--window-bottom, 0px);
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 24, 39, 0.42);
}
.action-menu {
  width: 100%;
  max-width: 640px;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 8px 20px calc(12px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.menu-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  width: 100%;
  margin: 0;
  padding: 8px 12px;
  border: 0;
  border-radius: 0;
  background: #fff;
  color: #1f2937;
  font-size: 16px;
  line-height: 1.5;
}
.menu-action::after {
  border: 0;
}
.menu-action:focus-visible {
  outline: 2px solid #660874;
}
.menu-delete {
  color: #b42318;
}
.menu-cancel {
  border-top: 1px solid #e5e7eb;
  color: #667085;
}
</style>
