<template>
  <view
    class="uploads-page page-content page-state-layout"
    :class="{ 'uploads-page--state': !user.isLoggedIn }"
    :aria-busy="loading"
  >
    <EmptyState
      class="page-state-region"
      v-if="!user.isLoggedIn"
      title="登录后查看上传记录"
      icon="edit"
      action-text="登录"
      @action="login"
    />
    <template v-else>
      <ReviewListSkeleton v-if="loading && !initialized" />
      <view
        v-if="error"
        class="error-feedback"
        :class="{ 'page-state-region': !items.length && !detachedUpload }"
        role="alert"
        ><text class="error-feedback__message">{{ error }}</text
        ><button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          :disabled="loading"
          @click="retry"
        >
          重新加载
        </button></view
      >
      <text v-if="actionError" class="upload-error" role="alert">{{ actionError }}</text>
      <view v-if="focusError" class="error-feedback" role="alert">
        <text class="error-feedback__message">{{ focusError }}</text>
        <button
          v-if="focusId"
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          :disabled="loading"
          @click="refresh()"
        >
          重试
        </button>
      </view>
      <EmptyState
        class="page-state-region"
        v-if="initialized && !items.length && !detachedUpload && !error"
        title="暂无上传记录"
        icon="edit"
      />
      <view class="uploads-list">
        <view v-for="item in items" :id="'upload-' + item.id" :key="item.id">
          <UploadRecord
            :item="item"
            :highlighted="item.id === focusedUpload?.id"
            :actions-disabled="!!withdrawing || confirming"
            :withdrawing="withdrawing === item.id"
            @edit="edit(item)"
            @withdraw="confirmWithdraw(item)"
            @open-dish="openDish"
          />
        </view>
      </view>
      <view v-if="items.length" class="uploads-footer">
        <button
          v-if="hasMore && !error"
          class="upload-action"
          :disabled="loading"
          @click="loadMore"
        >
          {{ loading ? '加载中…' : '加载更多' }}
        </button>
        <text v-else-if="!error">没有更多了</text>
      </view>
      <view v-if="detachedUpload" id="upload-notification-detail" class="notification-detail">
        <text class="notification-detail-title">消息对应记录</text>
        <UploadRecord
          :item="detachedUpload"
          highlighted
          :actions-disabled="!!withdrawing || confirming"
          :withdrawing="withdrawing === detachedUpload.id"
          @edit="edit(detachedUpload)"
          @withdraw="confirmWithdraw(detachedUpload)"
          @open-dish="openDish"
        />
      </view>
    </template>
    <FloatingActionButton
      v-if="user.isLoggedIn"
      label="申请新增菜品"
      icon="plus"
      @click="createContribution"
    />
  </view>
</template>
<script setup lang="ts">
import { openLogin } from '@/utils/login-navigation';

import { computed, nextTick, ref, watch, onScopeDispose } from 'vue';
import { onLoad, onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import EmptyState from '@/components/EmptyState.vue';
import FloatingActionButton from '@/components/FloatingActionButton.vue';
import ReviewListSkeleton from '@/components/skeleton/ReviewListSkeleton.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';
import { useMyUploads } from './composables/use-my-uploads';
import UploadRecord from './components/UploadRecord.vue';
import type { MyUploadItem } from '@/types/api';
const user = useUserStore();
const {
  items,
  focusedUpload,
  detachedUpload,
  focusId,
  focusError,
  loading,
  initialized,
  error,
  actionError,
  withdrawing,
  hasMore,
  refresh,
  retry,
  loadMore,
  withdraw,
} = useMyUploads();
const focusSelector = computed(() =>
  focusedUpload.value
    ? detachedUpload.value
      ? '#upload-notification-detail'
      : '#upload-' + focusedUpload.value.id
    : ''
);
const confirming = ref(false);
let active = true;
let visible = false;
let locateVersion = 0;
let locatedId = '';
onScopeDispose(() => {
  active = false;
  locateVersion++;
});
watch(
  () => user.sessionVersion,
  () => {
    confirming.value = false;
  },
  { flush: 'sync' }
);
onLoad(options => {
  locatedId = '';
  locateVersion++;
  focusId.value = options?.id || '';
});
onShow(() => {
  visible = true;
  void refresh();
});
onHide(() => {
  visible = false;
  locateVersion++;
});
watch(
  focusId,
  () => {
    locatedId = '';
    locateVersion++;
  },
  { flush: 'sync' }
);
watch(
  [focusSelector, loading],
  async ([selector, busy]) => {
    if (busy) {
      locateVersion++;
      return;
    }
    const id = focusId.value;
    if (!visible || !selector || locatedId === id) return;
    const version = locateVersion;
    const isCurrent = () =>
      active &&
      visible &&
      version === locateVersion &&
      !loading.value &&
      selector === focusSelector.value &&
      locatedId !== id;
    await nextTick();
    if (!isCurrent()) return;
    uni
      .createSelectorQuery()
      .select(selector)
      .boundingClientRect(result => {
        const rect = result as UniApp.NodeInfo | null;
        if (!isCurrent() || !rect) return;
        locatedId = id;
        const { windowHeight } = uni.getSystemInfoSync();
        if (rect.top! < 0 || rect.bottom! > windowHeight)
          uni.pageScrollTo({ selector, duration: 200 });
      })
      .exec();
  },
  { flush: 'post' }
);
onPullDownRefresh(async () => {
  try {
    await refresh();
  } finally {
    uni.stopPullDownRefresh();
  }
});
const login = () => openLogin();
const createContribution = () => {
  if (requireStudent()) uni.navigateTo({ url: '/pages/add-dish/index' });
};
const edit = (item: MyUploadItem) => {
  if (requireStudent())
    uni.navigateTo({ url: '/pages/add-dish/index?uploadId=' + encodeURIComponent(item.id) });
};
const openDish = (id: string) =>
  uni.navigateTo({ url: '/pages/dish/index?id=' + encodeURIComponent(id) });
async function confirmWithdraw(item: MyUploadItem) {
  if (confirming.value || withdrawing.value || !requireStudent()) return;
  const session = user.sessionVersion;
  confirming.value = true;
  try {
    const confirmed = await new Promise<boolean>(resolve =>
      uni.showModal({
        title: '撤回提交',
        content: '撤回后停止审核，上传记录会保留。',
        confirmText: '撤回',
        success: result => resolve(result.confirm),
        fail: () => resolve(false),
      })
    );
    if (confirmed && active && session === user.sessionVersion) await withdraw(item);
  } finally {
    if (active && session === user.sessionVersion) confirming.value = false;
  }
}
</script>
<style scoped>
.uploads-page {
  padding: 0 20px calc(96px + env(safe-area-inset-bottom));
  background: #fff;
  color: #1f2937;
}
.uploads-page--state {
  padding-bottom: 0;
}
.upload-error {
  color: #b42318;
}
.notification-detail {
  margin-top: 24px;
}
.notification-detail-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}
.upload-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  flex-shrink: 0;
  margin: 0;
  padding: 8px 4px;
  border: 0;
  border-radius: 4px;
  background: #fff;
  color: #660874;
  font-size: 14px;
  line-height: 1.5;
}
.upload-action::after {
  border: 0;
}
.upload-action:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.upload-action:active {
  background: #f9f5fa;
}
.upload-action[disabled] {
  opacity: 0.55;
}
.upload-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  font-size: 14px;
  line-height: 1.6;
}
.uploads-footer {
  display: flex;
  justify-content: center;
  padding: 20px 0;
  color: #667085;
  font-size: 14px;
}
</style>
