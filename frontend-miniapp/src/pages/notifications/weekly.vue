<template>
  <view class="weekly-page page-state-layout page-content" :aria-busy="loading">
    <LoginGate title="登录后查看本周推荐" icon="star">
      <view v-if="week" class="weekly-heading"
        ><text class="weekly-hint">{{ week }} 起</text></view
      >
      <AsyncState
        :loading="loading"
        :initialized="initialized"
        :has-content="!!items.length"
        :error="error"
        loading-title="正在加载推荐…"
        empty-title="本期暂无可查看的菜品"
        empty-icon="star"
        @retry="load"
      />
      <DishSummaryCard
        v-for="dish in items"
        :key="dish.id"
        class="weekly-dish"
        :dish="dish"
        @select="openDish"
      />
    </LoginGate>
  </view>
</template>
<script setup lang="ts">
import { nextTick, onScopeDispose, ref, watch } from 'vue';
import { onLoad, onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import type { Dish } from '@/types/api';
import { getWeeklyNotificationCollection } from '@/api/modules/notifications';
import { useUserStore } from '@/store/modules/use-user-store';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
const user = useUserStore();
const week = ref('');
const items = ref<Dish[]>([]);
const loading = ref(false);
const initialized = ref(false);
const error = ref('');
let active = true;
let visible = true;
let version = 0;
async function load() {
  if (!week.value) {
    error.value = '推荐期次不存在';
    return;
  }
  if (!user.isLoggedIn) {
    error.value = '请登录后查看本周推荐';
    return;
  }
  const request = ++version;
  const session = user.sessionVersion;
  const current = () => active && visible && request === version && session === user.sessionVersion;
  loading.value = true;
  error.value = '';
  try {
    const response = await getWeeklyNotificationCollection(week.value);
    if (!current()) return;
    if (response.code !== 200) throw new Error(response.message || '推荐加载失败');
    items.value = response.data.items;
    initialized.value = true;
  } catch (cause) {
    if (current()) error.value = cause instanceof Error ? cause.message : '推荐加载失败，请重试';
  } finally {
    if (current()) loading.value = false;
  }
}
const openDish = (id: string) =>
  uni.navigateTo({ url: `/pages/dish/index?id=${encodeURIComponent(id)}` });
watch(
  () => user.sessionVersion,
  session => {
    version++;
    items.value = [];
    initialized.value = false;
    loading.value = false;
    void nextTick(() => {
      if (active && visible && session === user.sessionVersion) void load();
    });
  },
  { flush: 'sync' }
);
onLoad(options => {
  week.value = String(options?.week || '');
});
onShow(() => {
  visible = true;
  void load();
});
onHide(() => {
  visible = false;
  version++;
  loading.value = false;
});
onScopeDispose(() => {
  active = false;
  version++;
});
onPullDownRefresh(async () => {
  try {
    await load();
  } finally {
    uni.stopPullDownRefresh();
  }
});
</script>
<style scoped>
.weekly-page {
  box-sizing: border-box;
  padding: 16px 20px calc(32px + env(safe-area-inset-bottom));
  color: #1f2937;
  background: #fff;
}
.weekly-heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
.weekly-hint {
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}
@media (max-width: 360px) {
  .weekly-page {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
