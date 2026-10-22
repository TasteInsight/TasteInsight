<template>
  <view v-if="visible" class="invite-overlay" @tap="close" @touchmove.stop.prevent>
    <view
      class="invite-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="t('social.createInvite')"
      @tap.stop
    >
      <view class="invite-heading"
        ><text>{{ t('social.createInvite') }}</text
        ><button
          class="invite-button"
          :aria-label="t('social.closeInvite')"
          :disabled="saving"
          @click="close"
        >
          {{ t('social.close') }}
        </button></view
      >
      <text class="invite-hint">{{ t('social.invitePrivacy') }}</text>
      <view class="invite-fields">
        <UiPicker
          mode="date"
          :value="date"
          :start="startDate"
          :end="endDate"
          :disabled="saving"
          @change="date = $event.detail.value"
        >
          <view class="invite-field"
            ><text>{{ t('social.date') }}</text
            ><text>{{ date }}</text></view
          >
        </UiPicker>
        <UiPicker mode="time" :value="time" :disabled="saving" @change="time = $event.detail.value">
          <view class="invite-field"
            ><text>{{ t('social.meetTime') }}</text
            ><text>{{ time }}</text></view
          >
        </UiPicker>
        <UiPicker
          mode="selector"
          :range="canteens"
          range-key="name"
          :value="canteenIndex"
          :disabled="saving || loading || !canteens.length"
          @change="canteenIndex = Number($event.detail.value)"
        >
          <view class="invite-field"
            ><text>{{ t('social.diningHall') }}</text
            ><text>{{
              canteens[canteenIndex]?.name ||
              (loading ? t('social.loading') : t('social.selectCanteen'))
            }}</text></view
          >
        </UiPicker>
        <UiPicker
          mode="selector"
          :range="capacities"
          :value="capacityIndex"
          :disabled="saving"
          @change="capacityIndex = Number($event.detail.value)"
        >
          <view class="invite-field"
            ><text>{{ t('social.totalPeople') }}</text
            ><text>{{ t('social.peopleCount', { count: capacities[capacityIndex] }) }}</text></view
          >
        </UiPicker>
      </view>
      <view v-if="errorText" class="invite-error error-feedback" role="alert"
        ><text class="error-feedback__message">{{ errorText }}</text
        ><button
          v-if="!canteens.length"
          class="error-feedback__action"
          hover-class="error-feedback__action--pressed"
          @click="loadCanteens"
        >
          {{ t('social.retry') }}
        </button></view
      >
      <button
        class="invite-button invite-publish"
        :disabled="saving || loading || !canteens.length"
        @click="publish"
      >
        {{ saving ? t('social.publishing') : t('social.confirmPublishInvite') }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { computed, ref, watch, onScopeDispose } from 'vue';
import UiPicker from '@/components/UiPicker.vue';
import { getCanteenList } from '@/api/modules/canteen';
import { createDiningInvite } from '@/api/modules/meal-plan';
import { useUserStore } from '@/store/modules/use-user-store';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import type { Canteen } from '@/types/api';
import { campusToday, coversDate, planDateKey } from '../utils/meal-plan-date';

const props = defineProps<{
  visible: boolean;
  plan: EnrichedMealPlan | null;
  initialDate?: string;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const userStore = useUserStore();
const canteens = ref<Canteen[]>([]);
const canteenIndex = ref(0);
const date = ref('');
const time = ref('12:00');
const capacities = [2, 3, 4, 5, 6, 7, 8];
const capacityIndex = ref(0);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const errorText = computed(() =>
  error.value.startsWith('social.') ? t(error.value) : error.value
);
let generation = 0;
let disposed = false;
const startDate = computed(() => (props.plan ? planDateKey(props.plan.startDate) : campusToday()));
const endDate = computed(() => (props.plan ? planDateKey(props.plan.endDate) : campusToday()));
const capture = () => {
  const version = generation;
  const session = userStore.sessionVersion;
  return () =>
    !disposed && props.visible && version === generation && session === userStore.sessionVersion;
};
async function loadCanteens() {
  const current = capture();
  loading.value = true;
  error.value = '';
  try {
    const items: Canteen[] = [];
    let pages = 1;
    for (let page = 1; page <= pages; page += 1) {
      const response = await getCanteenList({ page, pageSize: 50 });
      if (!current()) return;
      items.push(...response.data.items);
      pages = response.data.meta.totalPages;
    }
    canteens.value = items;
    const preferred = items.findIndex(item => item.id === props.plan?.dishes[0]?.canteenId);
    canteenIndex.value = Math.max(0, preferred);
  } catch (cause) {
    if (current())
      error.value = cause instanceof Error ? cause.message : 'social.canteensLoadFailed';
  } finally {
    if (current()) loading.value = false;
  }
}
watch(
  [() => props.visible, () => props.plan?.id, () => userStore.sessionVersion],
  () => {
    generation += 1;
    saving.value = false;
    loading.value = false;
    error.value = '';
    if (!props.visible || !props.plan) return;
    date.value =
      props.initialDate ||
      (coversDate(props.plan, campusToday()) ? campusToday() : startDate.value);
    time.value = { breakfast: '08:00', lunch: '12:00', dinner: '18:00', nightsnack: '21:00' }[
      props.plan.mealTime
    ];
    capacityIndex.value = 0;
    canteens.value = [];
    void loadCanteens();
  },
  { immediate: true }
);
async function publish() {
  if (saving.value || !props.plan || !canteens.value[canteenIndex.value]) return;
  const current = capture();
  saving.value = true;
  error.value = '';
  try {
    await createDiningInvite(props.plan.id, {
      date: date.value,
      startsAt: `${date.value}T${time.value}:00+08:00`,
      canteenId: canteens.value[canteenIndex.value].id,
      capacity: capacities[capacityIndex.value],
    });
    if (!current()) return;
    uni.showToast({ title: t('social.invitePublished'), icon: 'success' });
    emit('saved');
  } catch (cause) {
    if (current()) error.value = cause instanceof Error ? cause.message : 'social.publishFailed';
  } finally {
    if (current()) saving.value = false;
  }
}
function close() {
  if (!saving.value) emit('close');
}
onScopeDispose(() => {
  disposed = true;
});
</script>

<style scoped>
.invite-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 24, 39, 0.42);
}
.invite-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: auto;
  padding: 12px 20px calc(20px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: #fff;
  color: #1f2937;
}
.invite-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
}
.invite-hint {
  display: block;
  margin: 10px 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: #667085;
}
.invite-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.invite-field {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: var(--field-min-height);
  padding: var(--field-padding);
  box-sizing: border-box;
  border: 1px solid var(--field-border-color);
  border-radius: var(--field-radius);
  font-size: var(--field-font-size);
  line-height: var(--field-line-height);
}
.invite-button {
  display: flex;
  align-items: center;
  justify-content: center;
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
.invite-button::after {
  border: 0;
}
.invite-publish {
  width: 100%;
  margin-top: 20px;
  background: #660874;
  color: #fff;
  font-weight: 600;
}
.invite-button[disabled] {
  opacity: 0.5;
}
.invite-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.invite-button:active {
  opacity: 0.72;
}
</style>
