<template>
  <view class="dining-page" :aria-busy="loading">
    <EmptyState
      v-if="!user.isLoggedIn"
      title="登录后查看约饭邀请"
      icon="users"
      action-text="登录"
      @action="login"
    />
    <view v-if="user.isLoggedIn" class="dining-tabs" role="tablist" aria-label="约饭邀请">
      <button
        class="dining-button dining-tab"
        :class="{ 'dining-selected': !mine }"
        role="tab"
        tabindex="0"
        :aria-selected="!mine"
        @click="squareAction.activate"
        @keydown="squareAction.handleKeydown"
        @keyup="squareAction.handleKeyup"
        @blur="squareAction.clearPress"
      >
        广场
      </button>
      <button
        class="dining-button dining-tab"
        :class="{ 'dining-selected': mine }"
        role="tab"
        tabindex="0"
        :aria-selected="mine"
        @click="mineAction.activate"
        @keydown="mineAction.handleKeydown"
        @keyup="mineAction.handleKeyup"
        @blur="mineAction.clearPress"
      >
        我的
      </button>
    </view>
    <button v-if="user.isLoggedIn && !canContribute" class="dining-access" @click="verifyIdentity">
      <UiIcon name="shield" :size="16" /><text>认证后可参与约饭</text
      ><UiIcon name="chevron-right" :size="16" />
    </button>
    <view v-if="error" class="dining-error error-feedback" role="alert"
      ><text class="error-feedback__message">{{ error }}</text
      ><button
        class="error-feedback__action"
        hover-class="error-feedback__action--pressed"
        @click="load(failedAppend)"
      >
        重新加载
      </button></view
    >
    <view v-if="loading && !items.length" class="dining-loading" role="status">正在加载邀请…</view>
    <EmptyState
      v-else-if="initialized && !items.length && !error"
      :title="mine ? '还没有邀请或申请' : '暂时没有可加入的邀请'"
      icon="users"
    />
    <view v-for="invite in items" :key="invite.id" class="dining-invite">
      <view class="dining-invite-heading"
        ><text class="dining-host">{{ invite.host.nickname }}</text
        ><text class="dining-state">{{ statusLabels[invite.status] }}</text></view
      >
      <text class="dining-meal"
        >{{ invite.date }} {{ mealNames[invite.mealTime] }} {{ timeText(invite.startsAt) }}</text
      >
      <text class="dining-hint">{{ invite.canteen.name }}</text>
      <text class="dining-hint"
        >{{ invite.acceptedCount + 1 }} / {{ invite.capacity }} 人（包括发起人）</text
      >
      <view v-if="invite.host.id === ownerId" class="dining-applications">
        <text v-if="!invite.applications?.length" class="dining-hint">暂未收到申请</text>
        <view
          v-for="application in invite.applications"
          :key="application.id"
          class="dining-application"
        >
          <view
            ><text>{{ application.user.nickname }}</text
            ><text class="dining-hint">{{ applicationLabels[application.status] }}</text></view
          >
          <view
            v-if="application.status === 'pending' && ['open', 'full'].includes(invite.status)"
            class="dining-actions"
          >
            <button
              class="dining-button"
              :disabled="!!busy[invite.id] || !canContribute"
              @click="decide(invite, application.id, 'reject')"
            >
              拒绝
            </button>
            <button
              class="dining-button dining-primary"
              :disabled="!!busy[invite.id] || !canContribute || invite.status === 'full'"
              @click="decide(invite, application.id, 'accept')"
            >
              接受
            </button>
          </view>
        </view>
        <button
          v-if="['open', 'full'].includes(invite.status)"
          class="dining-button dining-cancel"
          :disabled="!!busy[invite.id]"
          @click="cancel(invite)"
        >
          取消本次邀请
        </button>
      </view>
      <view v-else class="dining-actions dining-join">
        <text v-if="invite.myApplication" class="dining-hint">{{
          applicationLabels[invite.myApplication.status]
        }}</text>
        <button
          v-if="
            invite.myApplication &&
            ['pending', 'accepted'].includes(invite.myApplication.status) &&
            ['open', 'full'].includes(invite.status)
          "
          class="dining-button"
          :disabled="!!busy[invite.id]"
          @click="run(invite, () => withdrawDiningApplication(invite.id))"
        >
          {{ invite.myApplication.status === 'accepted' ? '退出本次同行' : '撤回申请' }}
        </button>
        <button
          v-else-if="
            (!invite.myApplication || invite.myApplication.status === 'withdrawn') &&
            invite.status === 'open'
          "
          class="dining-button dining-primary"
          :disabled="!!busy[invite.id] || !canContribute"
          @click="run(invite, () => applyDiningInvite(invite.id))"
        >
          {{ busy[invite.id] ? '提交中…' : '申请一起吃' }}
        </button>
      </view>
    </view>
    <button
      v-if="!error && page < totalPages"
      class="dining-button dining-more"
      :disabled="loading"
      @click="load(true)"
    >
      {{ loading ? '加载中…' : '加载更多' }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import {
  getDiningInvites,
  getDiningInvite,
  applyDiningInvite,
  decideDiningApplication,
  withdrawDiningApplication,
  cancelDiningInvite,
  type DiningInvite,
} from '@/api/modules/meal-plan';
import type { ApiResponse } from '@/types/api';
import EmptyState from '@/components/EmptyState.vue';
import UiIcon from '@/components/UiIcon.vue';
import { useButtonActivation } from '@/composables/use-button-activation';

const props = withDefaults(defineProps<{ active?: boolean; inviteId?: string }>(), {
  active: true,
  inviteId: '',
});
const user = useUserStore();
const ownerId = computed(() => user.userInfo?.id);
const canContribute = computed(() => user.userInfo?.capabilities?.canContribute === true);
const mine = ref(false);
const squareAction = useButtonActivation(() => switchTab(false));
const mineAction = useButtonActivation(() => switchTab(true));
const items = ref<DiningInvite[]>([]);
const loading = ref(false);
const initialized = ref(false);
const error = ref('');
const failedAppend = ref(false);
const busy = ref<Record<string, boolean>>({});
const page = ref(1);
const totalPages = ref(1);
const detailId = ref(props.inviteId);
let visible = props.active;
let disposed = false;
let version = 0;
let visibilityVersion = 0;
let writeRevision = 0;
const statusLabels = { open: '接受申请', full: '名额已满', expired: '已结束', cancelled: '已取消' };
const applicationLabels = {
  pending: '等待确认',
  accepted: '已接受',
  rejected: '未通过',
  withdrawn: '已撤回',
};
const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', nightsnack: '夜宵' };
const timeText = (value: string) =>
  new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(11, 16);
const capture = () => {
  const session = user.sessionVersion;
  const tab = mine.value;
  const visibility = visibilityVersion;
  return () =>
    !disposed &&
    visible &&
    visibility === visibilityVersion &&
    session === user.sessionVersion &&
    tab === mine.value;
};
async function load(append = false) {
  if (!visible || !user.isLoggedIn) return;
  const current = capture();
  const request = ++version;
  const revision = writeRevision;
  const nextPage = append ? page.value + 1 : 1;
  loading.value = true;
  error.value = '';
  try {
    const response = detailId.value
      ? {
          data: {
            items: [(await getDiningInvite(detailId.value)).data],
            meta: { page: 1, totalPages: 1 },
          },
        }
      : await getDiningInvites(mine.value, nextPage);
    if (!current() || request !== version) return;
    if (revision !== writeRevision) {
      await load(false);
      return;
    }
    items.value = append ? [...items.value, ...response.data.items] : response.data.items;
    page.value = response.data.meta.page;
    totalPages.value = response.data.meta.totalPages;
    initialized.value = true;
  } catch (cause) {
    if (current() && request === version) {
      failedAppend.value = append;
      error.value = cause instanceof Error ? cause.message : '邀请加载失败，请重试';
    }
  } finally {
    if (current() && request === version) loading.value = false;
  }
}
function switchTab(value: boolean) {
  visibilityVersion += 1;
  mine.value = value;
  detailId.value = '';
  items.value = [];
  initialized.value = false;
  void load(false);
}
async function run(invite: DiningInvite, operation: () => Promise<ApiResponse<DiningInvite>>) {
  if (busy.value[invite.id]) return;
  const current = capture();
  const accountSession = user.sessionVersion;
  busy.value[invite.id] = true;
  try {
    const response = await operation();
    if (disposed || accountSession !== user.sessionVersion) return;
    writeRevision += 1;
    if (!current()) {
      if (visible) void load(false);
      return;
    }
    items.value = items.value.map(item => (item.id === invite.id ? response.data : item));
  } catch (cause) {
    if (current())
      uni.showToast({
        title: cause instanceof Error ? cause.message : '操作失败，请重试',
        icon: 'none',
      });
  } finally {
    if (current()) delete busy.value[invite.id];
  }
}
const decide = (invite: DiningInvite, id: string, action: 'accept' | 'reject') =>
  run(invite, () => decideDiningApplication(invite.id, id, action));
async function cancel(invite: DiningInvite) {
  const current = capture();
  const confirmed = await new Promise<boolean>(resolve =>
    uni.showModal({
      title: '取消邀请',
      content: '取消后将停止接受申请，已申请的同学可以看到取消状态。',
      success: result => resolve(!!result.confirm),
      fail: () => resolve(false),
    })
  );
  if (confirmed && current()) await run(invite, () => cancelDiningInvite(invite.id));
}
watch(
  () => [props.active, props.inviteId] as const,
  ([active, inviteId]) => {
    visible = active;
    version += 1;
    visibilityVersion += 1;
    busy.value = {};
    loading.value = false;
    detailId.value = inviteId;
    if (active) void load(false);
  },
  { immediate: true, flush: 'sync' }
);
watch(
  () => [user.sessionVersion, user.isLoggedIn],
  () => {
    version += 1;
    items.value = [];
    busy.value = {};
    initialized.value = false;
    loading.value = false;
    error.value = '';
    void nextTick(() => {
      if (visible && user.isLoggedIn) void load(false);
    });
  },
  { flush: 'sync' }
);
const login = () => uni.navigateTo({ url: '/pages/login/index' });
const verifyIdentity = () => uni.navigateTo({ url: '/pages/profile/identity' });
defineExpose({
  refresh: () => load(false),
  loadMore: () => {
    if (!loading.value && !error.value && page.value < totalPages.value) return load(true);
  },
});
onScopeDispose(() => {
  disposed = true;
});
</script>

<style scoped>
.dining-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 4px 20px calc(24px + env(safe-area-inset-bottom));
  background: #fff;
  color: #1f2937;
}
.dining-hint {
  display: block;
  color: #667085;
  font-size: 13px;
  line-height: 1.7;
}
.dining-tabs {
  display: flex;
  gap: 20px;
  margin-bottom: 4px;
}
.dining-button {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 44px;
  margin: 0;
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #660874;
  font-size: 14px;
  line-height: 1.5;
}
.dining-button::after {
  border: 0;
}
.dining-button[disabled] {
  opacity: 0.5;
}
.dining-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.dining-button:active {
  opacity: 0.72;
}
.dining-tab {
  padding: 0;
  min-height: 44px;
  border-radius: 0;
  border-bottom: 2px solid transparent;
  color: #667085;
}
.dining-selected {
  border-color: #660874;
  color: #660874;
  font-weight: 600;
}
.dining-access {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
.dining-access::after {
  border: 0;
}
.dining-access:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.dining-invite {
  padding: 20px 0;
  border-bottom: 1px solid #e5e7eb;
}
.dining-invite-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.dining-host {
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.dining-state {
  flex-shrink: 0;
  color: #667085;
  font-size: 12px;
}
.dining-meal {
  display: block;
  margin-bottom: 4px;
  font-size: 15px;
  font-weight: 500;
}
.dining-applications {
  padding-top: 12px;
}
.dining-application {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  font-size: 14px;
}
.dining-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dining-join {
  justify-content: flex-end;
  margin-top: 12px;
}
.dining-primary {
  background: #660874;
  color: #fff;
}
.dining-cancel {
  margin-top: 12px;
  color: #b42318;
}
.dining-loading {
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
}
.dining-empty .dining-hint {
  margin-top: 10px;
}
.dining-more {
  margin: 16px auto;
}
</style>
