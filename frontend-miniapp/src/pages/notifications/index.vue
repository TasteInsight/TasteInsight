<template>
  <view
    class="notifications-page page-state-layout page-content"
    :class="{ 'notifications-page--state': !user.isLoggedIn || !unread }"
    :aria-busy="loading"
  >
    <EmptyState
      class="page-state-region"
      v-if="!user.isLoggedIn"
      title="登录后查看消息"
      icon="bell"
      action-text="登录"
      @action="login"
    />
    <template v-else>
      <view v-if="loading && !items.length" aria-hidden="true">
        <view v-for="item in 4" :key="item" class="notification-skeleton">
          <view class="notification-skeleton-icon" />
          <view class="notification-skeleton-main"><view /><view /></view>
        </view>
      </view>
      <EmptyState
        class="page-state-region"
        v-else-if="initialized && !items.length && !error"
        title="暂无新消息"
        icon="bell"
      />
      <view v-if="items.length" class="notification-list">
        <button
          v-for="item in items"
          :key="item.id"
          class="notification-item list-row-action"
          hover-class="list-row-pressed"
          :class="{ 'notification-unread': !item.readAt }"
          :disabled="!!opening[item.id]"
          :aria-label="
            [notificationText(item), item.subject, !item.readAt ? '未读' : '']
              .filter(Boolean)
              .join('，')
          "
          @click="open(item)"
        >
          <UserAvatar v-if="item.actor" :src="item.actor.avatar" :label="item.actor.nickname" />
          <view v-else class="notification-system" aria-hidden="true">
            <UiIcon
              :name="notificationIcon(item)"
              :size="21"
              :tone="!item.readAt && item.type === 'upload_approved' ? 'primary' : 'muted'"
            />
          </view>
          <view class="notification-main">
            <view class="notification-summary">
              <text class="notification-copy">{{ notificationTitle(item) }}</text>
              <view class="notification-meta">
                <text class="notification-date">{{ formatNotificationDate(item.createdAt) }}</text>
                <view v-if="!item.readAt" class="notification-dot" aria-hidden="true" />
              </view>
            </view>
            <text v-if="item.subject" class="notification-subject">{{ item.subject }}</text>
          </view>
        </button>
      </view>
      <view
        v-if="error"
        class="notification-error error-feedback"
        :class="{ 'page-state-region': !items.length }"
        role="alert"
        ><text class="error-feedback__message">{{ error }}</text
        ><button
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="load(failedAppend)"
        >
          重新加载
        </button></view
      >
      <button
        v-else-if="hasMore && items.length"
        class="notification-button notification-more"
        :disabled="loading"
        @click="load(true)"
      >
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
    </template>
    <FloatingActionButton
      v-if="user.isLoggedIn && (unread > 0 || markingAll)"
      icon="eye"
      :label="markingAll ? '标记中…' : '全部已读'"
      :disabled="markingAll"
      @click="markAll"
    />
  </view>
</template>
<script setup lang="ts">
import { openLogin } from '@/utils/login-navigation';

import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';
import { onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import UserAvatar from '@/components/UserAvatar.vue';
import EmptyState from '@/components/EmptyState.vue';
import FloatingActionButton from '@/components/FloatingActionButton.vue';
import UiIcon from '@/components/UiIcon.vue';
import {
  getNotifications,
  getUnreadNotificationCount,
  readNotification,
  readAllNotifications,
  type InboxNotification,
} from '@/api/modules/notifications';
import {
  formatNotificationDate,
  notificationText,
  notificationTitle,
  notificationIcon,
  notificationDestination,
} from './notification-content';
import { useUserStore } from '@/store/modules/use-user-store';

const user = useUserStore();
const items = ref<InboxNotification[]>([]);
const loading = ref(false);
const initialized = ref(false);
const error = ref('');
const unread = ref(0);
const page = ref(0);
const totalPages = ref(1);
const hasMore = computed(() => page.value < totalPages.value);
const opening = ref<Record<string, boolean>>({});
const markingAll = ref(false);
let active = true;
let visible = true;
let epoch = 0;
let version = 0;
let readRevision = 0;
let failedAppend = false;
const capture = () => {
  const session = user.sessionVersion;
  const generation = epoch;
  return () => active && visible && session === user.sessionVersion && generation === epoch;
};
const login = () => openLogin();
async function load(append = false) {
  if (!user.isLoggedIn || (append && (loading.value || !hasMore.value))) return;
  const current = capture();
  const request = ++version;
  const revision = readRevision;
  loading.value = true;
  error.value = '';
  try {
    const [response, count] = await Promise.all([
      getNotifications({ page: append ? page.value + 1 : 1, pageSize: 20 }),
      getUnreadNotificationCount(),
    ]);
    if (!current() || request !== version) return;
    if (response.code !== 200 || count.code !== 200)
      throw new Error(response.code !== 200 ? response.message : count.message);
    if (revision !== readRevision) {
      loading.value = false;
      await load(append);
      return;
    }
    const incoming = new Set(response.data.items.map(item => item.id));
    items.value = [
      ...(append ? items.value.filter(item => !incoming.has(item.id)) : []),
      ...response.data.items,
    ];
    page.value = response.data.meta.page;
    totalPages.value = response.data.meta.totalPages;
    unread.value = count.data.unreadCount;
    initialized.value = true;
  } catch (cause) {
    if (current() && request === version) {
      failedAppend = append;
      error.value = cause instanceof Error ? cause.message : '消息加载失败，请重试';
    }
  } finally {
    if (current() && request === version) loading.value = false;
  }
}
async function open(item: InboxNotification) {
  if (opening.value[item.id] || markingAll.value) return;
  const current = capture();
  opening.value = { ...opening.value, [item.id]: true };
  try {
    if (!item.readAt) {
      const response = await readNotification(item.id);
      if (!current()) return;
      if (response.code !== 200) throw new Error(response.message || '消息读取失败');
      readRevision++;
      item.readAt = new Date().toISOString();
      unread.value = Math.max(0, unread.value - 1);
    }
    if (!current()) return;
    const destination = notificationDestination(item);
    if (!destination) {
      uni.showToast({ title: '内容暂不可查看', icon: 'none' });
      return;
    }
    const options = {
      url: destination.url,
      fail: () => uni.showToast({ title: '页面打开失败，请重试', icon: 'none' as const }),
    };
    if (destination.tab) uni.switchTab(options);
    else uni.navigateTo(options);
  } catch (cause) {
    if (current())
      uni.showToast({
        title: cause instanceof Error ? cause.message : '消息读取失败，请重试',
        icon: 'none',
      });
  } finally {
    if (current()) {
      const next = { ...opening.value };
      delete next[item.id];
      opening.value = next;
    }
  }
}
async function markAll() {
  if (markingAll.value || !unread.value || Object.keys(opening.value).length) return;
  const current = capture();
  markingAll.value = true;
  try {
    const response = await readAllNotifications();
    if (!current()) return;
    if (response.code !== 200) throw new Error(response.message || '标记失败');
    readRevision++;
    const now = new Date().toISOString();
    items.value = items.value.map(item => ({ ...item, readAt: item.readAt || now }));
    unread.value = 0;
  } catch (cause) {
    if (current())
      uni.showToast({
        title: cause instanceof Error ? cause.message : '标记失败，请重试',
        icon: 'none',
      });
  } finally {
    if (current()) markingAll.value = false;
  }
}
function reset() {
  epoch++;
  version++;
  items.value = [];
  loading.value = false;
  initialized.value = false;
  error.value = '';
  unread.value = 0;
  page.value = 0;
  totalPages.value = 1;
  opening.value = {};
  markingAll.value = false;
}
watch(
  () => user.sessionVersion,
  session => {
    reset();
    void nextTick(() => {
      if (active && visible && session === user.sessionVersion) void load();
    });
  },
  { flush: 'sync' }
);
onShow(() => {
  visible = true;
  void load();
});
onHide(() => {
  visible = false;
  epoch++;
  version++;
  loading.value = false;
  opening.value = {};
  markingAll.value = false;
});
onScopeDispose(() => {
  active = false;
  epoch++;
});
onPullDownRefresh(async () => {
  try {
    await load();
  } finally {
    uni.stopPullDownRefresh();
  }
});
onReachBottom(() => {
  if (!error.value) void load(true);
});
</script>
<style scoped>
.notifications-page {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 4px 20px calc(88px + env(safe-area-inset-bottom));
  background: #fff;
  color: #1f2937;
}
.notifications-page--state {
  padding-bottom: 0;
}
.notification-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  margin: 0;
  padding: 10px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #660874;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}
.notification-button::after,
.notification-item::after {
  border: 0;
}
.notification-button[disabled] {
  color: #667085;
  background: transparent;
  cursor: default;
}
.notification-item[disabled] {
  opacity: 0.65;
  cursor: wait;
  background: #fff;
}
.notification-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.notification-button:not([disabled]):active {
  background: #f4f4f5;
}
.notification-item {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 16px 0;
  border: 0;
  border-bottom: 1px solid #eef0f3;
  border-radius: 0;
  background: #fff;
  color: #1f2937;
  text-align: left;
  line-height: 1.6;
  cursor: pointer;
}
.notification-item:last-child {
  border-bottom: 0;
}
.notification-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  min-height: 40px;
}
.notification-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.notification-copy {
  flex: 1;
  min-width: 0;
  color: #475467;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.notification-unread .notification-copy {
  color: #1f2937;
  font-weight: 600;
}
.notification-meta {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
}
.notification-date {
  color: #667085;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  white-space: nowrap;
}
.notification-subject {
  display: -webkit-box;
  overflow: hidden;
  color: #667085;
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.notification-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #660874;
}
.notification-system {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #f6f7f8;
}
.notification-more {
  display: flex;
  margin: 16px auto 0;
}
.notification-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #eef0f3;
}
.notification-skeleton-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #f4f4f5;
}
.notification-skeleton-main {
  flex: 1;
}
.notification-skeleton-main view {
  width: 76%;
  height: 14px;
  margin: 6px 0;
  border-radius: 4px;
  background: #f4f4f5;
}
.notification-skeleton-main view:last-child {
  width: 52%;
}
@media (hover: hover) {
  .notification-button:not([disabled]):hover {
    background: #f8f9fa;
  }
}
@media (max-width: 360px) {
  .notifications-page {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
