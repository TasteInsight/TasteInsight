<template><DiningInvites :active="visible" :invite-id="inviteId" ref="panel" /></template>
<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import DiningInvites from './components/DiningInvites.vue';
const inviteId = ref('');
const visible = ref(false);
const panel = ref<{ refresh: () => unknown; loadMore: () => unknown } | null>(null);
onLoad(options => {
  inviteId.value = typeof options?.id === 'string' ? options.id : '';
});
onShow(() => {
  visible.value = true;
});
onHide(() => {
  visible.value = false;
});
onReachBottom(() => {
  void panel.value?.loadMore();
});
onPullDownRefresh(async () => {
  try {
    await panel.value?.refresh();
  } finally {
    uni.stopPullDownRefresh();
  }
});
</script>
