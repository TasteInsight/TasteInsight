<template>
  <view class="notifications-page" :aria-busy="loading">
    <view class="notifications-heading"
      ><button
        v-if="user.isLoggedIn"
        class="notification-button"
        :disabled="markingAll || !unread"
        @click="markAll"
      >
        {{ markingAll ? '标记中…' : '全部已读' }}
      </button></view
    >
    <EmptyState
      v-if="!user.isLoggedIn"
      title="登录后查看消息"
      icon="bell"
      action-text="登录"
      @action="login"
    />
    <template v-else>
      <view v-if="loading && !items.length" aria-hidden="true"
        ><view v-for="item in 4" :key="item" class="notification-skeleton"><view /><view /></view
      ></view>
      <EmptyState
        v-else-if="initialized && !items.length && !error"
        title="暂无新消息"
        icon="bell"
      />
      <button
        v-for="item in items"
        :key="item.id"
        class="notification-item"
        :class="{ 'notification-unread': !item.readAt }"
        :disabled="!!opening[item.id]"
        :aria-label="notificationText(item) + (!item.readAt ? '，未读' : '')"
        @click="open(item)"
      >
        <UserAvatar v-if="item.actor" :src="item.actor.avatar" :label="item.actor.nickname" /><view
          v-else
          class="notification-system"
          aria-hidden="true"
          ><UiIcon name="bell" :size="22" /></view
        ><view class="notification-main"
          ><text class="notification-copy">{{ notificationText(item) }}</text
          ><text class="notification-hint notification-date">{{
            formatDate(item.createdAt)
          }}</text></view
        ><view v-if="!item.readAt" class="notification-dot" aria-hidden="true" /><UiIcon
          name="chevron-right"
          :size="18"
        />
      </button>
      <view v-if="error" class="notification-error" role="alert"
        ><text>{{ error }}</text
        ><button class="notification-button" @click="load(failedAppend)">重新加载</button></view
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
  </view>
</template>
<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';
import { onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import dayjs from 'dayjs';
import UserAvatar from '@/components/UserAvatar.vue';
import EmptyState from '@/components/EmptyState.vue';
import UiIcon from '@/components/UiIcon.vue';
import {
  getNotifications,
  getUnreadNotificationCount,
  readNotification,
  readAllNotifications,
  type InboxNotification,
} from '@/api/modules/notifications';
import { notificationText, notificationDestination } from './notification-content';
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
const formatDate = (date: string) => dayjs(date).format('MM-DD HH:mm');
const login = () => uni.navigateTo({ url: '/pages/login/index' });
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
  padding: 20px 20px calc(32px + env(safe-area-inset-bottom));
  background: #fff;
  color: #1f2937;
}
.notifications-heading {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}
.notification-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #660874;
  font-size: 14px;
  line-height: 1.5;
}
.notification-button::after,
.notification-item::after {
  border: 0;
}
.notification-button[disabled],
.notification-item[disabled] {
  opacity: 0.5;
}
.notification-button:focus-visible,
.notification-item:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.notification-button:active,
.notification-item:active {
  background: #f4f4f5;
}
.notification-hint {
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}
.notification-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 20px 0;
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  background: #fff;
  color: #1f2937;
  text-align: left;
  line-height: 1.6;
}
.notification-main {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.notification-copy {
  font-size: 15px;
  overflow-wrap: anywhere;
}
.notification-unread .notification-copy {
  font-weight: 600;
}
.notification-date {
  font-size: 12px;
}
.notification-dot {
  width: 7px;
  height: 7px;
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
  background: #f4f4f5;
  color: #660874;
}
.notification-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 0;
  color: #b42318;
  font-size: 14px;
}
.notification-more {
  display: flex;
  margin: 16px auto 0;
}
.notification-skeleton {
  padding: 24px 0;
  border-bottom: 1px solid #e5e7eb;
}
.notification-skeleton view {
  width: 80%;
  height: 16px;
  margin: 8px 0;
  border-radius: 4px;
  background: #f4f4f5;
}
.notification-skeleton view:last-child {
  width: 30%;
}
@media (max-width: 360px) {
  .notifications-page {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
