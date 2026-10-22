<template>
  <view class="profile-plans page-state-content" :aria-busy="planStore.loading">
    <!-- #ifndef MP-WEIXIN -->
    <view class="profile-plan-visibility">
      <view class="profile-plan-visibility-copy"
        ><text class="profile-plan-label">{{ t('account.profile.showOnProfile') }}</text
        ><text class="profile-plan-hint">{{
          t('account.profile.onlyPlansMarkedPublicWill')
        }}</text></view
      >
      <switch
        :checked="privacyDraft"
        :disabled="privacySaving || !user.userInfo || (!canContribute && !privacyDraft)"
        :aria-label="t('account.profile.showOnProfile')"
        color="#660874"
        @change="changeVisibility"
      />
    </view>
    <!-- #endif -->
    <view v-if="plans.length" class="profile-plan-toolbar"
      ><button
        class="profile-plan-button"
        @click="manageButton.activate"
        @keydown="manageButton.handleKeydown"
        @keyup="manageButton.handleKeyup"
        @blur="manageButton.clearPress"
        role="button"
        tabindex="0"
      >
        {{ t('account.profile.managePlans') }}<UiIcon name="chevron-right" :size="15" /></button
    ></view>
    <AsyncState
      :loading="planStore.loading"
      :initialized="planStore.initialized"
      :has-content="!!plans.length"
      :error="planStore.error"
      :loading-title="t('account.profile.loadingPlans')"
      :empty-title="t('account.profile.noMealPlansYet')"
      empty-icon="calendar"
      :empty-action-text="t('account.profile.planAMeal')"
      @retry="refresh"
      @action="openPlanning"
    />
    <view v-for="plan in plans" :key="plan.id" class="profile-plan">
      <view class="profile-plan-heading"
        ><text class="profile-plan-date"
          >{{ dateText(plan.startDate, plan.endDate) }} · {{ mealNames[plan.mealTime] }}</text
        ><text v-if="plan.isExpired" class="profile-plan-hint">{{
          t('account.profile.ended')
        }}</text></view
      >
      <DishSummaryCard v-for="dish in plan.dishes" :key="dish.id" :dish="dish" @select="openDish" />
      <text v-if="!plan.dishesReady" class="profile-plan-hint">{{
        t('account.profile.dishDetailsHaveNotFinished')
      }}</text>
    </view>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed, onScopeDispose, ref, watch } from 'vue';
import dayjs from 'dayjs';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import UiIcon from '@/components/UiIcon.vue';
import AsyncState from '@/components/AsyncState.vue';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { useUserStore } from '@/store/modules/use-user-store';
import { useButtonActivation } from '@/composables/use-button-activation';
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });
const user = useUserStore();
const planStore = usePlanStore();
const plans = computed(() => [
  ...planStore.currentPlans,
  ...planStore.historyPlans.slice().reverse(),
]);
const mealNames = computed(() => ({
  breakfast: t('account.profile.breakfast'),
  lunch: t('account.profile.lunch'),
  dinner: t('account.profile.dinner'),
  nightsnack: t('account.profile.lateNightSnack'),
}));
const dateText = (start: string, end: string) =>
  dayjs(start).format(t('account.profile.mmmD')) +
  (dayjs(start).isSame(end, 'day') ? '' : ' — ' + dayjs(end).format(t('account.profile.mmmD')));
async function refresh() {
  if (!user.isLoggedIn) return;
  try {
    await planStore.fetchPlans();
  } catch {
    /* The store retains the read error and loaded plans. */
  }
}
const openPlanning = () => uni.switchTab({ url: '/pages/planning/index' });
const openDish = (id: string) =>
  uni.navigateTo({ url: '/pages/dish/index?id=' + encodeURIComponent(id) });
const manageButton = useButtonActivation(openPlanning);
defineExpose({ refresh });
// #ifndef MP-WEIXIN
const privacyDraft = ref(false);
const privacySaving = ref(false);
const canContribute = computed(() => user.userInfo?.capabilities?.canContribute === true);
let mounted = true;
let visibilityVersion = 0;
watch(
  () => user.userInfo?.settings?.showMealPlans,
  value => {
    privacyDraft.value = value === true;
  },
  { immediate: true }
);
watch(
  () => user.sessionVersion,
  () => {
    visibilityVersion++;
    privacySaving.value = false;
    privacyDraft.value = user.userInfo?.settings?.showMealPlans === true;
  },
  { flush: 'sync' }
);
async function changeVisibility(event: Event | { detail: { value: boolean } }) {
  const value = (event as { detail?: { value?: boolean } }).detail?.value === true;
  if (
    !mounted ||
    !props.active ||
    privacySaving.value ||
    !user.isLoggedIn ||
    !user.userInfo ||
    (value && !canContribute.value)
  )
    return;
  if (value === privacyDraft.value) return;
  const session = user.sessionVersion;
  const version = ++visibilityVersion;
  const current = () => mounted && session === user.sessionVersion && version === visibilityVersion;
  privacyDraft.value = value;
  privacySaving.value = true;
  try {
    await user.updateProfileAction({ settings: { showMealPlans: value } });
  } catch (cause) {
    if (current() && props.active)
      uni.showToast({
        title: cause instanceof Error ? cause.message : t('account.profile.unableToSaveSettings'),
        icon: 'none',
      });
  } finally {
    if (current()) {
      privacyDraft.value = user.userInfo?.settings?.showMealPlans === true;
      privacySaving.value = false;
    }
  }
}
onScopeDispose(() => {
  mounted = false;
  visibilityVersion++;
});
// #endif
</script>
<style scoped>
.profile-plans {
  min-height: 168px;
}
.profile-plan-visibility {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #eaecf0;
}
.profile-plan-visibility-copy {
  min-width: 0;
}
.profile-plan-label {
  display: block;
  font-size: 14px;
  line-height: 1.6;
}
.profile-plan-hint {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}
.profile-plan-visibility .profile-plan-hint {
  margin-top: 2px;
}
.profile-plan-toolbar {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
.profile-plan-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  margin: 0;
  padding: 8px 0;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #660874;
  font-size: 13px;
  line-height: 1.5;
}
.profile-plan-button::after {
  border: 0;
}
.profile-plan-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.profile-plan-button:active {
  background: #f4f4f5;
}
.profile-plan {
  padding-top: 16px;
}
.profile-plan-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.profile-plan-date {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
}
</style>
