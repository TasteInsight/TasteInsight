<template>
  <view class="page-content page-state-layout">
    <DiningInvites :active="visible" :invite-id="inviteId" ref="panel" />
  </view>
</template>
<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { onLoad, onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import DiningInvites from './components/DiningInvites.vue';
const inviteId = ref('');
const visible = ref(false);
const panel = ref<{
  needsInitialLoad: boolean;
  refresh: () => unknown;
  loadMore: () => unknown;
} | null>(null);
let hasShown = false;
onLoad(options => {
  inviteId.value = typeof options?.id === 'string' ? options.id : '';
});
onShow(() => {
  const refreshRetained = hasShown && !panel.value?.needsInitialLoad;
  visible.value = true;
  if (refreshRetained) {
    void nextTick(() => {
      if (visible.value) void panel.value?.refresh();
    });
  }
  hasShown = true;
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
